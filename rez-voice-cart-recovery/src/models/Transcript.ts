import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import { TranscriptDocument } from '../types';

const transcriptSegmentSchema = new Schema(
  {
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    speaker: { type: String, enum: ['ai', 'user', 'unknown'], required: true },
    text: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, default: 1 }
  },
  { _id: false }
);

export interface ITranscript extends MongooseDocument, Omit<TranscriptDocument, '_id'> {}

const transcriptSchema = new Schema<ITranscript>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'Call',
      required: true,
      index: true
    },
    callSid: {
      type: String,
      required: true,
      index: true
    },
    recordingSid: {
      type: String,
      sparse: true
    },
    transcriptionText: {
      type: String
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    segments: {
      type: [transcriptSegmentSchema],
      default: []
    },
    summary: {
      type: String,
      maxlength: 500
    },
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    },
    keyTopics: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'transcripts'
  }
);

// Indexes
transcriptSchema.index({ callId: 1, createdAt: -1 });
transcriptSchema.index({ sentiment: 1 });
transcriptSchema.index({ keyTopics: 1 });
transcriptSchema.index({ createdAt: -1 });

// Text index for searching transcripts
transcriptSchema.index(
  { transcriptionText: 'text', summary: 'text' },
  { weights: { transcriptionText: 10, summary: 5 } }
);

// Post-save middleware to update call document
transcriptSchema.post('save', async function (doc) {
  try {
    const { CallModel } = await import('./Call');
    await CallModel.findByIdAndUpdate(doc.callId, {
      transcriptId: doc._id
    });
  } catch (error) {
    console.error('Failed to update call with transcript ID:', error);
  }
});

// Instance methods
transcriptSchema.methods.getUserTranscript = function (): string {
  return this.segments
    .filter(s => s.speaker === 'user')
    .map(s => s.text)
    .join(' ');
};

transcriptSchema.methods.getAiTranscript = function (): string {
  return this.segments
    .filter(s => s.speaker === 'ai')
    .map(s => s.text)
    .join(' ');
};

transcriptSchema.methods.getFullTranscript = function (): string {
  return this.segments
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n');
};

transcriptSchema.methods.calculateDuration = function (): number {
  if (this.segments.length === 0) return 0;
  const lastSegment = this.segments[this.segments.length - 1];
  return lastSegment.endTime;
};

// Static methods
transcriptSchema.statics.findByCallSid = function (callSid: string) {
  return this.findOne({ callSid }).populate('callId');
};

transcriptSchema.statics.findByDateRange = function (startDate: Date, endDate: Date) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate('callId')
    .sort({ createdAt: -1 });
};

transcriptSchema.statics.findBySentiment = function (sentiment: 'positive' | 'negative' | 'neutral') {
  return this.find({ sentiment }).populate('callId').sort({ createdAt: -1 });
};

transcriptSchema.statics.searchTranscripts = function (query: string, limit = 50) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('callId');
};

export const TranscriptModel = mongoose.model<ITranscript>('Transcript', transcriptSchema);
