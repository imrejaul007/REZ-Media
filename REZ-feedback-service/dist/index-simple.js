"use strict";
/**
 * REZ Feedback Service - Learning Infrastructure (Standalone)
 *
 * Captures outcomes and closes the loop:
 * Event → Decision → Feedback → Learning
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const mongoose_1 = __importDefault(require("mongoose"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4010', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://work_db_user:ZAFYAYH1zK0C74Ap@rez-intent-graph.a8ilqgi.mongodb.net/rez-feedback?retryWrites=true&w=majority';
// Schema
const feedbackSchema = new mongoose_1.default.Schema({
    correlationId: { type: String, required: true, index: true },
    decision: String,
    confidence: Number,
    outcome: { type: String, enum: ['approved', 'rejected', 'ignored', 'modified', 'pending'], default: 'pending' },
    actionTaken: String,
    latencyMs: { type: Number, default: 0 },
    modifications: mongoose_1.default.Schema.Types.Mixed,
    feedbackType: { type: String, enum: ['explicit', 'implicit'], default: 'explicit' },
    source: { type: String, default: 'api' },
    decisionCreatedAt: Date,
    feedbackReceivedAt: { type: Date, default: Date.now },
    learningSignal: {
        accuracyDelta: Number,
        confidenceAdjusted: Number,
    },
    processed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
const Feedback = mongoose_1.default.models.Feedback || mongoose_1.default.model('Feedback', feedbackSchema, 'feedbacks');
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
function log(message, meta) {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [FEEDBACK] ${message}`, meta ? JSON.stringify(meta) : '');
}
// Health
app.get('/health', async (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rez-feedback-service',
        mode: 'learning',
        mongodb: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
});
app.get('/live', (req, res) => {
    res.json({ alive: true });
});
app.get('/', (req, res) => {
    res.json({
        service: 'rez-feedback-service',
        version: '1.0.0',
        mode: 'learning',
        endpoints: {
            health: '/health',
            feedback: 'POST /feedback',
            stats: '/stats',
            pending: '/feedback/pending',
        },
    });
});
// Main feedback endpoint
app.post('/feedback', async (req, res) => {
    const data = req.body;
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('[FEEDBACK RECEIVED]', { correlationId: data.correlation_id, outcome: data.outcome });
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        // Check duplicate
        if (data.correlation_id) {
            const existing = await Feedback.findOne({ correlationId: data.correlation_id });
            if (existing && existing.outcome !== 'pending') {
                log('[DUPLICATE DETECTED]', { correlationId: data.correlation_id });
                return res.json({
                    success: true,
                    feedbackId: existing._id,
                    duplicate: true,
                });
            }
        }
        // Calculate learning signal
        const confidence = data.confidence || 0.5;
        const learningSignal = calculateLearningSignal({ ...data, confidence });
        const feedback = new Feedback({
            correlationId: data.correlation_id,
            decision: data.decision,
            confidence: data.confidence,
            outcome: data.outcome || 'approved',
            actionTaken: data.action_taken,
            latencyMs: data.latency_ms || 0,
            modifications: data.modifications,
            feedbackType: data.feedback_type || 'explicit',
            source: data.source || 'api',
            decisionCreatedAt: data.decision_created_at ? new Date(data.decision_created_at) : undefined,
            feedbackReceivedAt: new Date(),
            learningSignal,
            processed: false,
        });
        await feedback.save();
        log('[FEEDBACK STORED]', {
            feedbackId: feedback._id,
            correlationId: feedback.correlationId,
            outcome: feedback.outcome,
            learningSignal,
        });
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        res.json({
            success: true,
            feedbackId: feedback._id,
            correlationId: feedback.correlationId,
            outcome: feedback.outcome,
            learningSignal,
        });
    }
    catch (error) {
        log('[ERROR]', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get feedback by correlation
app.get('/feedback/:correlationId', async (req, res) => {
    try {
        const feedback = await Feedback.findOne({ correlationId: req.params.correlationId });
        if (!feedback) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json({ feedback });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Pending feedback
app.get('/feedback/pending', async (req, res) => {
    try {
        const pending = await Feedback.find({ outcome: 'pending' }).sort({ createdAt: -1 }).limit(50);
        res.json({ count: pending.length, pending });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Stats
app.get('/stats', async (req, res) => {
    try {
        const total = await Feedback.countDocuments();
        const byOutcome = await Feedback.aggregate([
            { $group: { _id: '$outcome', count: { $sum: 1 } } }
        ]);
        const avgLatency = await Feedback.aggregate([
            { $match: { latencyMs: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$latencyMs' } } }
        ]);
        res.json({ total, byOutcome, avgLatencyMs: avgLatency[0]?.avg || 0 });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
function calculateLearningSignal(data) {
    const { outcome, confidence } = data;
    let accuracyDelta = 0;
    let confidenceAdjusted = confidence || 0.5;
    if (outcome === 'approved') {
        accuracyDelta = 0.05;
        confidenceAdjusted = Math.min(1, confidence + 0.02);
    }
    else if (outcome === 'rejected') {
        accuracyDelta = -0.1;
        confidenceAdjusted = Math.max(0, confidence - 0.05);
    }
    else if (outcome === 'modified') {
        accuracyDelta = 0;
    }
    return {
        accuracyDelta: Math.round(accuracyDelta * 1000) / 1000,
        confidenceAdjusted: Math.round(confidenceAdjusted * 1000) / 1000,
    };
}
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
async function start() {
    try {
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('Starting REZ Feedback Service (Learning Mode)');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('Connecting to MongoDB...', { uri: MONGODB_URI.substring(0, 50) + '...' });
        await mongoose_1.default.connect(MONGODB_URI);
        log('MongoDB connected successfully');
        app.listen(PORT, () => {
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('REZ Feedback Service started', { port: PORT });
            log('Health: http://localhost:' + PORT + '/health');
            log('Stats: http://localhost:' + PORT + '/stats');
            log('Feedback: POST http://localhost:' + PORT + '/feedback');
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });
    }
    catch (error) {
        log('[FATAL ERROR]', { error: error.message });
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index-simple.js.map