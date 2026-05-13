import axios from 'axios';
import { TranscriptModel, ITranscript } from '../models/Transcript';
import { CallModel } from '../models/Call';
import { conversationEngine } from './conversationEngine';
import { CallStatus, UserIntent } from '../types';

interface TranscriptionSegment {
  startTime: number;
  endTime: number;
  speaker: 'ai' | 'user' | 'unknown';
  text: string;
  confidence: number;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export class TranscriptService {
  /**
   * Get transcript by call ID
   */
  async getTranscriptByCallId(callId: string): Promise<ITranscript | null> {
    return TranscriptModel.findOne({ callId }).populate('callId');
  }

  /**
   * Get transcript by call SID
   */
  async getTranscriptByCallSid(callSid: string): Promise<ITranscript | null> {
    return TranscriptModel.findOne({ callSid }).populate('callId');
  }

  /**
   * List transcripts with pagination
   */
  async listTranscripts(options: {
    page?: number;
    limit?: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    transcripts: ITranscript[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);

    const query: any = {};
    if (options.sentiment) {
      query.sentiment = options.sentiment;
    }
    if (options.dateFrom || options.dateTo) {
      query.createdAt = {};
      if (options.dateFrom) {
        query.createdAt.$gte = options.dateFrom;
      }
      if (options.dateTo) {
        query.createdAt.$lte = options.dateTo;
      }
    }

    const [transcripts, total] = await Promise.all([
      TranscriptModel.find(query)
        .populate('callId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      TranscriptModel.countDocuments(query)
    ]);

    return { transcripts, total, page, limit };
  }

  /**
   * Create or update transcript from Twilio transcription
   */
  async processTwilioTranscription(
    callSid: string,
    transcriptionText: string
  ): Promise<ITranscript | null> {
    const transcript = await TranscriptModel.findOne({ callSid });
    if (!transcript) {
      return null;
    }

    // Parse transcription into segments
    const segments = this.parseTranscriptionText(transcriptionText);

    // Update transcript
    transcript.transcriptionText = transcriptionText;
    transcript.segments = segments;
    transcript.confidence = this.calculateAverageConfidence(segments);

    // Analyze sentiment
    const sentimentResult = await this.analyzeSentiment(transcriptionText);
    transcript.sentiment = sentimentResult.sentiment;

    // Extract key topics
    transcript.keyTopics = this.extractKeyTopics(transcriptionText);

    // Generate summary
    transcript.summary = await this.generateSummary(transcript);

    await transcript.save();

    // Update call record
    await CallModel.updateOne(
      { twilioCallSid: callSid },
      { $set: { transcriptId: transcript._id } }
    );

    return transcript;
  }

  /**
   * Process recording and create transcript
   */
  async processRecording(
    callSid: string,
    recordingSid: string,
    recordingUrl: string
  ): Promise<ITranscript | null> {
    // Find existing transcript or create new one
    let transcript = await TranscriptModel.findOne({ callSid });

    if (!transcript) {
      const call = await CallModel.findOne({ twilioCallSid: callSid });
      if (!call) {
        return null;
      }

      transcript = new TranscriptModel({
        callId: call._id,
        callSid
      });
    }

    transcript.recordingSid = recordingSid;

    // Fetch transcription from Twilio
    try {
      const transcription = await this.fetchTranscription(recordingSid);
      if (transcription) {
        transcript.transcriptionText = transcription.text;
        transcript.segments = this.parseTranscriptionText(transcription.text);
        transcript.confidence = transcription.confidence;

        // Analyze sentiment
        const sentimentResult = await this.analyzeSentiment(transcription.text);
        transcript.sentiment = sentimentResult.sentiment;

        // Extract key topics
        transcript.keyTopics = this.extractKeyTopics(transcription.text);
      }
    } catch (error) {
      console.error('Failed to fetch transcription:', error);
    }

    await transcript.save();

    // Update call record
    await CallModel.updateOne(
      { twilioCallSid: callSid },
      { $set: { recordingUrl, transcriptId: transcript._id } }
    );

    return transcript;
  }

  /**
   * Add segment to transcript
   */
  async addSegment(
    callSid: string,
    segment: TranscriptionSegment
  ): Promise<ITranscript | null> {
    const transcript = await TranscriptModel.findOne({ callSid });
    if (!transcript) {
      return null;
    }

    transcript.segments.push(segment);
    transcript.segments.sort((a, b) => a.startTime - b.startTime);

    // Recalculate confidence
    transcript.confidence = this.calculateAverageConfidence(transcript.segments);

    // Update transcription text
    transcript.transcriptionText = transcript.segments
      .map(s => s.text)
      .join(' ');

    await transcript.save();
    return transcript;
  }

  /**
   * Parse transcription text into segments
   * This is a simplified implementation - in production, you'd use actual STT output
   */
  private parseTranscriptionText(text: string): TranscriptionSegment[] {
    const segments: TranscriptionSegment[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    let currentTime = 0;
    const avgSegmentDuration = 3; // seconds

    for (const line of lines) {
      const speakerMatch = line.match(/^(AI:|User:|Agent:)\s*/i);
      const speaker = speakerMatch
        ? (speakerMatch[1].toLowerCase().replace(':', '') as 'ai' | 'user' | 'unknown')
        : 'unknown';

      const textContent = speakerMatch ? line.replace(speakerMatch[0], '') : line;

      if (textContent.trim()) {
        segments.push({
          startTime: currentTime,
          endTime: currentTime + avgSegmentDuration,
          speaker: speaker === 'ai' ? 'ai' : speaker === 'user' ? 'user' : 'unknown',
          text: textContent.trim(),
          confidence: 0.85
        });
        currentTime += avgSegmentDuration + 0.5;
      }
    }

    return segments;
  }

  /**
   * Calculate average confidence from segments
   */
  private calculateAverageConfidence(segments: TranscriptionSegment[]): number {
    if (segments.length === 0) return 0;
    const sum = segments.reduce((acc, seg) => acc + seg.confidence, 0);
    return sum / segments.length;
  }

  /**
   * Analyze sentiment of text
   */
  private async analyzeSentiment(text: string): Promise<SentimentResult> {
    const positiveWords = [
      'yes', 'great', 'awesome', 'perfect', 'thank', 'thanks', 'love', 'amazing',
      'good', 'nice', 'helpful', 'excellent', 'wonderful', 'fantastic', 'happy'
    ];
    const negativeWords = [
      'no', 'not', 'bad', 'terrible', 'awful', 'hate', 'frustrated', 'angry',
      'disappointed', 'worst', 'horrible', 'problem', 'issue', 'slow', 'rude'
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    }

    const total = words.length || 1;
    const positiveRatio = positiveCount / total;
    const negativeRatio = negativeCount / total;

    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;

    if (positiveRatio > negativeRatio && positiveRatio > 0.05) {
      sentiment = 'positive';
      confidence = Math.min(0.5 + positiveRatio * 5, 0.95);
    } else if (negativeRatio > positiveRatio && negativeRatio > 0.05) {
      sentiment = 'negative';
      confidence = Math.min(0.5 + negativeRatio * 5, 0.95);
    } else {
      sentiment = 'neutral';
      confidence = 0.6;
    }

    return { sentiment, confidence };
  }

  /**
   * Extract key topics from transcription
   */
  private extractKeyTopics(text: string): string[] {
    const topics: string[] = [];
    const textLower = text.toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      'order': ['order', 'purchase', 'buy', 'cart', 'checkout'],
      'delivery': ['delivery', 'shipping', 'deliver', 'arriving', 'tracking'],
      'payment': ['payment', 'pay', 'price', 'cost', 'discount', 'cod'],
      'return': ['return', 'refund', 'exchange', 'replace'],
      'product': ['product', 'item', 'product', 'size', 'color'],
      'appointment': ['appointment', 'schedule', 'booking', 'slot', 'time'],
      'complaint': ['problem', 'issue', 'complaint', 'frustrated', 'wrong']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Generate summary from transcript
   */
  private async generateSummary(transcript: ITranscript): Promise<string> {
    const userText = transcript.getUserTranscript();
    const intentResult = await conversationEngine.detectIntent(userText);

    let summary = '';

    switch (intentResult.intent) {
      case UserIntent.CONFIRM:
        summary = 'Customer confirmed intent to complete order/purchase.';
        break;
      case UserIntent.DECLINE:
        summary = 'Customer declined or ended conversation.';
        break;
      case UserIntent.TRANSFER:
        summary = 'Customer requested transfer to human agent.';
        break;
      case UserIntent.ASK_QUESTION:
        summary = 'Customer asked questions about order/delivery/payment.';
        break;
      default:
        summary = 'General inquiry call completed.';
    }

    if (transcript.sentiment) {
      summary += ` Sentiment: ${transcript.sentiment}.`;
    }

    if (transcript.keyTopics.length > 0) {
      summary += ` Topics discussed: ${transcript.keyTopics.join(', ')}.`;
    }

    return summary;
  }

  /**
   * Fetch transcription from Twilio
   */
  private async fetchTranscription(recordingSid: string): Promise<{
    text: string;
    confidence: number;
  } | null> {
    // This would use Twilio API to fetch transcription
    // For now, return null as placeholder
    // In production, you'd call: GET /Accounts/{AccountSid}/Recordings/{RecordingSid}/Transcriptions.json
    return null;
  }

  /**
   * Search transcripts
   */
  async searchTranscripts(query: string, limit: number = 50): Promise<ITranscript[]> {
    return TranscriptModel.searchTranscripts(query, limit);
  }

  /**
   * Get transcript statistics
   */
  async getTranscriptStats(dateRange?: { start: Date; end: Date }): Promise<any> {
    const matchStage: any = {};
    if (dateRange) {
      matchStage.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    const stats = await TranscriptModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTranscripts: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          positiveCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } },
          negativeCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } },
          neutralCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] } },
          avgSegments: { $avg: { $size: '$segments' } }
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        totalTranscripts: 0,
        avgConfidence: 0,
        sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
        avgSegments: 0
      };
    }

    return {
      totalTranscripts: stats[0].totalTranscripts,
      avgConfidence: stats[0].avgConfidence || 0,
      sentimentBreakdown: {
        positive: stats[0].positiveCount,
        negative: stats[0].negativeCount,
        neutral: stats[0].neutralCount
      },
      avgSegments: stats[0].avgSegments || 0
    };
  }

  /**
   * Delete transcript
   */
  async deleteTranscript(transcriptId: string): Promise<boolean> {
    const result = await TranscriptModel.findByIdAndDelete(transcriptId);
    if (result) {
      // Update call record
      await CallModel.updateOne(
        { transcriptId },
        { $unset: { transcriptId: 1 } }
      );
      return true;
    }
    return false;
  }
}

export const transcriptService = new TranscriptService();
