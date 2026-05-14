"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const learning_1 = require("../services/learning");
const feedback_processor_1 = require("../workers/feedback-processor");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schema
const FeedbackInputSchema = zod_1.z.object({
    action_id: zod_1.z.string().min(1),
    outcome: zod_1.z.enum(['approved', 'rejected', 'ignored', 'failed', 'edited']),
    latency_ms: zod_1.z.number().nullable().optional(),
    confidence_score: zod_1.z.number().min(0).max(1),
    feedback_type: zod_1.z.enum(['explicit', 'implicit']),
    merchant_id: zod_1.z.string().min(1),
    event_type: zod_1.z.string().min(1),
    decision_made: zod_1.z.string().min(1),
    original_value: zod_1.z.any().optional(),
    edited_value: zod_1.z.any().optional(),
    timestamp: zod_1.z.number().optional()
});
// POST /feedback - Record feedback
router.post('/', async (req, res, next) => {
    try {
        const validation = FeedbackInputSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid feedback data',
                details: validation.error.errors
            });
        }
        const feedback = {
            ...validation.data,
            timestamp: validation.data.timestamp || Date.now()
        };
        // Queue for async processing
        await feedback_processor_1.feedbackProcessor.queueFeedback(feedback);
        res.status(201).json({
            success: true,
            message: 'Feedback recorded',
            feedback_id: `${feedback.action_id}_${feedback.timestamp}`
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /feedback/batch - Record multiple feedback items
router.post('/batch', async (req, res, next) => {
    try {
        const feedbackItems = zod_1.z.array(FeedbackInputSchema).safeParse(req.body);
        if (!feedbackItems.success) {
            return res.status(400).json({
                error: 'Invalid feedback data',
                details: feedbackItems.error.errors
            });
        }
        const timestamps = feedbackItems.data.map(item => Date.now());
        const feedbacks = feedbackItems.data.map((item, idx) => ({
            ...item,
            timestamp: item.timestamp || timestamps[idx]
        }));
        await feedback_processor_1.feedbackProcessor.queueBatchFeedback(feedbacks);
        res.status(201).json({
            success: true,
            message: `${feedbacks.length} feedback items queued`,
            count: feedbacks.length
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /feedback/stats/:merchantId - Get feedback stats for a merchant
router.get('/stats/:merchantId', async (req, res, next) => {
    try {
        const { merchantId } = req.params;
        const period = req.query.period || '7d';
        const stats = await learning_1.learningService.getStats(merchantId, period);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
// GET /feedback/actions/:actionId - Get action feedback history
router.get('/actions/:actionId', async (req, res, next) => {
    try {
        const { actionId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const history = await feedback_processor_1.feedbackProcessor.getActionHistory(actionId, limit);
        res.json({
            action_id: actionId,
            history,
            count: history.length
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /feedback/learning-insights - Get AI-readable learning insights
router.get('/learning-insights', async (req, res, next) => {
    try {
        const merchantId = req.query.merchantId;
        const minSeverity = req.query.minSeverity || 'low';
        const insights = await learning_1.learningService.generateInsights(merchantId, minSeverity);
        res.json({
            insights,
            generated_at: Date.now(),
            count: insights.length
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /feedback/patterns/:merchantId - Get feedback patterns
router.get('/patterns/:merchantId', async (req, res, next) => {
    try {
        const { merchantId } = req.params;
        const eventType = req.query.eventType;
        const patterns = await learning_1.learningService.analyzePatterns(merchantId, eventType);
        res.json({
            merchant_id: merchantId,
            patterns,
            analyzed_at: Date.now()
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /feedback/drift/:merchantId - Detect drift in agent performance
router.get('/drift/:merchantId', async (req, res, next) => {
    try {
        const { merchantId } = req.params;
        const threshold = parseFloat(req.query.threshold) || 0.1;
        const drift = await learning_1.learningService.detectDrift(merchantId, threshold);
        res.json({
            merchant_id: merchantId,
            drift_detections: drift,
            analyzed_at: Date.now()
        });
    }
    catch (error) {
        next(error);
    }
});
// Health check endpoint
router.get('/health', async (_req, res) => {
    res.json({
        service: 'rez-feedback-service',
        status: 'healthy',
        timestamp: Date.now()
    });
});
exports.default = router;
//# sourceMappingURL=feedback.js.map