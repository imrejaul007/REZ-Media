"use strict";
/**
 * REZ Feedback Service - Learning Infrastructure with Event Emission
 *
 * Complete loop:
 * Event → Decision → Feedback → Learning → ReZ Mind → AdaptiveScoringAgent → Better Decision
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const mongoose_1 = __importDefault(require("mongoose"));
const axios_1 = __importDefault(require("axios"));
// SECURITY FIX: HTML escaping helper for XSS prevention
function escapeHtml(str) {
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4010', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://work_db_user:ZAFYAYH1zK0C74Ap@rez-intent-graph.a8ilqgi.mongodb.net/rez-feedback?retryWrites=true&w=majority';
const EVENT_PLATFORM_URL = process.env.EVENT_PLATFORM_URL || 'http://localhost:4008';
// Schema
const feedbackSchema = new mongoose_1.default.Schema({
    // Core identifiers
    correlationId: { type: String, required: true, index: true },
    decision: String,
    confidence: Number,
    // Core outcome
    outcome: { type: String, enum: ['approved', 'rejected', 'ignored', 'modified', 'pending'], default: 'pending' },
    actionTaken: String,
    latencyMs: { type: Number, default: 0 },
    // Modification data
    modifications: mongoose_1.default.Schema.Types.Mixed,
    modificationDirection: { type: String, enum: ['up', 'down', 'neutral'], default: 'neutral' },
    deltaPercent: { type: Number, default: 0 },
    // DISCOVERY: WHY it changed
    reasonCategory: { type: String, enum: ['high_demand', 'low_trust', 'constraint', 'preference', 'habit', 'seasonality'], default: null },
    reasonDetail: { type: String, default: null },
    // DISCOVERY: Intention type
    intentionType: {
        correction: { type: Boolean, default: false },
        preference: { type: Boolean, default: false },
        constraint: { type: Boolean, default: false }
    },
    // DISCOVERY: Confidence gap analysis
    confidenceGap: { type: String, enum: ['high_delta_low_confidence', 'aligned', 'low_delta_high_confidence', 'unknown'], default: 'unknown' },
    // DISCOVERY: Context completeness
    contextCompleteness: {
        hadRecentSales: { type: Boolean, default: false },
        hadDayPattern: { type: Boolean, default: false },
        hadSeasonality: { type: Boolean, default: false },
        hadSupplierLeadTime: { type: Boolean, default: false },
        missingFeatures: [String]
    },
    // Ignored tracking
    ignoredAt: { type: Date, default: null },
    ignoredAfterHours: { type: Number, default: null },
    // Learning
    feedbackType: { type: String, enum: ['explicit', 'implicit'], default: 'explicit' },
    source: { type: String, default: 'api' },
    decisionCreatedAt: Date,
    feedbackReceivedAt: { type: Date, default: Date.now },
    learningSignal: {
        accuracyDelta: Number,
        confidenceAdjusted: Number,
        modificationWeightedDelta: Number,
    },
    merchantId: String,
    itemId: String,
    processed: { type: Boolean, default: false },
    learningEmitted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
// Modification patterns schema for merchant/item tracking
const modificationPatternSchema = new mongoose_1.default.Schema({
    merchantId: { type: String, required: true, index: true },
    itemId: { type: String, required: true },
    // Direction counts
    modifiedUpCount: { type: Number, default: 0 },
    modifiedDownCount: { type: Number, default: 0 },
    modifiedNeutralCount: { type: Number, default: 0 },
    // Delta statistics
    deltaSum: { type: Number, default: 0 },
    deltaSquaredSum: { type: Number, default: 0 }, // For variance calculation
    minDelta: { type: Number, default: 0 },
    maxDelta: { type: Number, default: 0 },
    // EWMA tracking for average delta
    avgDeltaEwma: { type: Number, default: 0 },
    // Timestamp of last update
    lastUpdated: { type: Date, default: Date.now },
    totalModifications: { type: Number, default: 0 },
});
const ModificationPattern = mongoose_1.default.models.ModificationPattern || mongoose_1.default.model('ModificationPattern', modificationPatternSchema, 'modification_patterns');
const Feedback = mongoose_1.default.models.Feedback || mongoose_1.default.model('Feedback', feedbackSchema, 'feedbacks');
// Learning guardrails configuration - STABILIZED
const LEARNING_CONFIG = {
    // STABILIZATION: Increased min samples to prevent early overfitting
    minSamplesBeforeUpdate: 15, // Was 5, increased to 15 for stability
    ewmaAlpha: 0.08, // Was 0.15, reduced to 0.08 for slower learning
    multiplierBounds: { min: 0.95, max: 1.05 }, // Was [0.8-1.3], tightened to [0.95-1.05]
    confidenceBiasBounds: { min: -0.1, max: 0.1 }, // Was [-0.2-0.2], tightened
    // Modification-specific learning
    modificationAlpha: 0.1, // Was 0.2, reduced for stability
    deltaPercentThreshold: 10, // Was 5, increased to require bigger changes
    maxDeltaPercent: 50, // Was 200, reduced to cap extreme modifications
    // Ignored feedback configuration
    ignoredTimeoutHours: 24, // Timeout in hours for pending feedback
    ignoredConfidencePenalty: 0.01, // Was 0.02, reduced for stability
    ignoredSignalMultiplier: 0.2, // Was 0.3, reduced weight
};
// Learning history entry schema
const learningHistoryEntrySchema = new mongoose_1.default.Schema({
    timestamp: { type: Date, default: Date.now },
    outcome: String,
    previousMultiplier: Number,
    newMultiplier: Number,
    previousBias: Number,
    newBias: Number,
    adjustmentReason: String,
    // Modification details for enriched history
    modificationDirection: { type: String, enum: ['up', 'down', 'neutral'], default: 'neutral' },
    deltaPercent: { type: Number, default: 0 },
    weightedAdjustment: Number, // Weight applied based on delta magnitude
});
// Learned parameters schema
const learnedParamsSchema = new mongoose_1.default.Schema({
    merchantId: { type: String, required: true },
    itemId: { type: String, required: true },
    confidenceBias: { type: Number, default: 0 },
    quantityMultiplier: { type: Number, default: 1.0 },
    approvalRate: { type: Number, default: 0 },
    totalDecisions: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    learningVersion: { type: Number, default: 1 },
    learningHistory: [learningHistoryEntrySchema],
});
const LearnedParams = mongoose_1.default.models.LearnedParams || mongoose_1.default.model('LearnedParams', learnedParamsSchema, 'learned_params');
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
        learning: 'active',
        mongodb: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
        eventPlatform: EVENT_PLATFORM_URL,
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
        description: 'Closes the loop: captures feedback and emits learning events',
        endpoints: {
            health: '/health',
            feedback: 'POST /feedback',
            stats: '/stats',
            learn: '/learn/:correlationId',
            params: '/learned-params/:merchantId/:itemId',
            loop: '/loop-test (triggers full loop)',
            dashboard: '/dashboard',
            liftData: '/lift-data',
            modificationStats: '/modification-stats',
            decisionTimeline: '/decision-timeline',
            safetyEvents: '/safety-events',
            processIgnored: 'POST /process-ignored (manual trigger for ignored feedback)',
            pendingCount: 'GET /pending-count (check pending feedback)',
        },
    });
});
// Dashboard endpoint - Enhanced with all requested sections
app.get('/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>REZ Learning Loop Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1419; color: #e7e9ea; min-height: 100vh; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 1.5rem; color: #1d9bf0; }
    h2 { font-size: 1rem; margin: 20px 0 10px; color: #71767b; text-transform: uppercase; letter-spacing: 0.05em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .card { background: #16181c; border-radius: 12px; padding: 20px; border: 1px solid #2f3336; }
    .card h3 { font-size: 0.8rem; color: #71767b; margin-bottom: 8px; }
    .card .value { font-size: 2rem; font-weight: 700; }
    .card .sub { font-size: 0.85rem; color: #71767b; margin-top: 5px; }
    .status-ok { color: #00ba7c; }
    .status-warn { color: #ffd400; }
    .status-err { color: #f4212e; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge-approved { background: #006a0033; color: #00ba7c; }
    .badge-rejected { background: #f4212e33; color: #f4212e; }
    .badge-pending { background: #ffd40033; color: #ffd400; }
    .badge-modified { background: #1d9bf033; color: #1d9bf0; }
    .badge-ignored { background: #71767b33; color: #71767b; }
    .config { background: #16181c; border-radius: 8px; padding: 15px; font-family: monospace; font-size: 0.85rem; }
    .config-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #2f3336; }
    .refresh-btn { background: #1d9bf0; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
    .refresh-btn:hover { background: #1a8cd8; }
    .refresh-btn:disabled { background: #2f3336; color: #71767b; cursor: not-allowed; }
    .lift-chart { display: flex; align-items: flex-end; gap: 30px; height: 200px; padding: 20px; background: #16181c; border-radius: 12px; border: 1px solid #2f3336; }
    .bar-container { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .bar { width: 60px; background: linear-gradient(180deg, #1d9bf0 0%, #1a8cd8 100%); border-radius: 6px 6px 0 0; transition: height 0.3s ease; }
    .bar.baseline { background: linear-gradient(180deg, #71767b 0%, #5a5f66 100%); }
    .bar-label { margin-top: 10px; font-size: 0.85rem; color: #71767b; }
    .bar-value { font-size: 1.2rem; font-weight: 700; color: #e7e9ea; }
    .lift-badge { background: #00ba7c; color: #fff; padding: 15px 25px; border-radius: 12px; text-align: center; }
    .lift-badge .label { font-size: 0.8rem; opacity: 0.9; }
    .lift-badge .value { font-size: 2rem; font-weight: 700; }
    .lift-badge.negative { background: #f4212e; }
    .mod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .mod-card { background: #16181c; border-radius: 8px; padding: 15px; border: 1px solid #2f3336; text-align: center; }
    .mod-card .icon { font-size: 1.5rem; margin-bottom: 5px; }
    .mod-card .up { color: #00ba7c; }
    .mod-card .down { color: #f4212e; }
    .timeline { display: flex; flex-direction: column; gap: 8px; }
    .timeline-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: #16181c; border-radius: 8px; border: 1px solid #2f3336; }
    .timeline-item .dot { width: 10px; height: 10px; border-radius: 50%; }
    .timeline-item .dot.approved { background: #00ba7c; }
    .timeline-item .dot.rejected { background: #f4212e; }
    .timeline-item .dot.pending { background: #ffd400; }
    .timeline-item .dot.modified { background: #1d9bf0; }
    .timeline-item .dot.ignored { background: #71767b; }
    .timeline-item .id { font-family: monospace; font-size: 0.8rem; color: #71767b; flex: 1; }
    .timeline-item .time { font-size: 0.75rem; color: #71767b; }
    .safety-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
    .safety-item { display: flex; align-items: center; gap: 10px; padding: 12px; background: #16181c; border-radius: 8px; border: 1px solid #2f3336; }
    .safety-item .icon { font-size: 1.2rem; }
    .safety-item .details { flex: 1; }
    .safety-item .details .title { font-weight: 600; font-size: 0.9rem; }
    .safety-item .details .desc { font-size: 0.75rem; color: #71767b; }
    .safety-item.cap { border-left: 3px solid #ffd400; }
    .safety-item.block { border-left: 3px solid #f4212e; }
    .no-data { text-align: center; padding: 30px; color: #71767b; }
    .timestamp { font-size: 0.75rem; color: #71767b; text-align: center; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>REZ Learning Loop Dashboard</h1>
      <button class="refresh-btn" id="refreshBtn" onclick="fetchData()">Refresh Data</button>
    </div>

    <h2>System Health</h2>
    <div class="grid" id="health"></div>

    <h2>Learning Configuration</h2>
    <div class="config" id="config"></div>

    <h2>Lift Chart</h2>
    <div class="card">
      <div class="lift-chart" id="liftChart">
        <div class="no-data">Loading lift data...</div>
      </div>
    </div>

    <h2>Modification Analysis</h2>
    <div class="card" id="modAnalysis">
      <div class="no-data">Loading modification data...</div>
    </div>

    <h2>Decision Timeline (Last 10)</h2>
    <div class="timeline" id="timeline">
      <div class="no-data">Loading timeline data...</div>
    </div>

    <h2>Safety Violations</h2>
    <div class="safety-grid" id="safety">
      <div class="no-data">Loading safety events...</div>
    </div>

    <h2>Loop Metrics</h2>
    <div class="grid" id="metrics"></div>

    <div class="timestamp" id="lastUpdated">Last updated: --</div>
  </div>

  <script>
    async function fetchData() {
      const btn = document.getElementById('refreshBtn');
      btn.disabled = true;
      btn.textContent = 'Loading...';

      try {
        const [health, stats, params, liftData, modStats, timeline, safety] = await Promise.all([
          fetch('/health').then(r => r.json()),
          fetch('/stats').then(r => r.json()),
          fetch('/learned-params/test_merchant/test_item').then(r => r.json()),
          fetch('/lift-data').then(r => r.json()),
          fetch('/modification-stats').then(r => r.json()),
          fetch('/decision-timeline').then(r => r.json()),
          fetch('/safety-events').then(r => r.json())
        ]);

        document.getElementById('health').innerHTML = [
          { label: 'Status', value: health.status, class: 'status-ok' },
          { label: 'Mode', value: health.mode },
          { label: 'Learning', value: health.learning },
          { label: 'MongoDB', value: health.mongodb, class: health.mongodb === 'connected' ? 'status-ok' : 'status-err' }
        ].map(item => \`
          <div class="card">
            <h3>\${item.label}</h3>
            <div class="value \${item.class || ''}">\${item.value}</div>
          </div>
        \`).join('');

        const config = params.config || {};
        document.getElementById('config').innerHTML = [
          ['Min Samples', config.minSamplesBeforeUpdate || 5],
          ['EWMA Alpha', config.ewmaAlpha || 0.15],
          ['Multiplier Bounds', config.multiplierBounds ? \`\${config.multiplierBounds.min} - \${config.multiplierBounds.max}\` : '0.8 - 1.3'],
          ['Bias Bounds', config.confidenceBiasBounds ? \`\${config.confidenceBiasBounds.min} to \${config.confidenceBiasBounds.max}\` : '-0.2 to 0.2']
        ].map(([k, v]) => \`<div class="config-item"><span>\${k}</span><span>\${v}</span></div>\`).join('');

        renderLiftChart(liftData);
        renderModAnalysis(modStats);
        renderTimeline(timeline);
        renderSafety(safety);

        document.getElementById('metrics').innerHTML = [
          { label: 'Total Feedback', value: stats.total || 0 },
          { label: 'Learning Emitted', value: stats.learningEmitted || 0 },
          { label: 'Learned Params', value: stats.learnedParamsCount || 0 },
          { label: 'Avg Latency', value: Math.round(stats.avgLatencyMs || 0) + 'ms' }
        ].map(item => \`
          <div class="card">
            <h3>\${item.label}</h3>
            <div class="value">\${item.value}</div>
          </div>
        \`).join('');

        document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleTimeString();

      } catch (e) {
        console.error('Error loading dashboard:', e);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh Data';
      }
    }

    function renderLiftChart(data) {
      const container = document.getElementById('liftChart');
      if (!data.hasEnoughData) {
        container.innerHTML = '<div class="no-data">Need more data for lift analysis (min 10 decisions)</div>';
        return;
      }

      const maxRate = Math.max(data.adaptiveRate, data.baselineRate, 60);
      const adaptiveHeight = (data.adaptiveRate / maxRate) * 150;
      const baselineHeight = (data.baselineRate / maxRate) * 150;
      const isPositive = data.lift >= 0;

      container.innerHTML = \`
        <div class="bar-container">
          <div class="bar-value">\${data.adaptiveRate}%</div>
          <div class="bar" style="height: \${adaptiveHeight}px"></div>
          <div class="bar-label">Adaptive</div>
        </div>
        <div class="bar-container">
          <div class="bar-value">\${data.baselineRate}%</div>
          <div class="bar baseline" style="height: \${baselineHeight}px"></div>
          <div class="bar-label">Baseline</div>
        </div>
        <div class="lift-badge \${isPositive ? '' : 'negative'}">
          <div class="label">LIFT</div>
          <div class="value">\${isPositive ? '+' : ''}\${data.lift}%</div>
        </div>
      \`;
    }

    function renderModAnalysis(data) {
      const container = document.getElementById('modAnalysis');
      if (data.totalWithModifications === 0) {
        container.innerHTML = '<div class="no-data">No modifications recorded yet</div>';
        return;
      }

      container.innerHTML = \`
        <div class="mod-grid">
          <div class="mod-card">
            <div class="icon up">+</div>
            <div class="mod-card up">
              <div class="value">\${data.modifiedUp}</div>
              <div class="sub">Modified Up</div>
            </div>
          </div>
          <div class="mod-card">
            <div class="icon down">-</div>
            <div class="mod-card down">
              <div class="value">\${data.modifiedDown}</div>
              <div class="sub">Modified Down</div>
            </div>
          </div>
        </div>
        <div style="margin-top: 15px; text-align: center;">
          <span style="color: #71767b;">Avg Delta:</span>
          <span style="font-weight: 700; font-size: 1.2rem; color: \${data.avgDeltaPercent >= 0 ? '#00ba7c' : '#f4212e'};">
            \${data.avgDeltaPercent >= 0 ? '+' : ''}\${data.avgDeltaPercent}%
          </span>
        </div>
      \`;
    }

    function renderTimeline(data) {
      const container = document.getElementById('timeline');
      if (!data.timeline || data.timeline.length === 0) {
        container.innerHTML = '<div class="no-data">No decisions recorded yet</div>';
        return;
      }

      container.innerHTML = data.timeline.map(item => \`
        <div class="timeline-item">
          <div class="dot \${escapeHtml(item.outcome || '')}"></div>
          <span class="badge badge-\${escapeHtml(item.outcome || '')}">\${escapeHtml((item.outcome || '').toUpperCase())}</span>
          <span class="id">\${escapeHtml(item.correlationId || '')}</span>
          <span style="color: #71767b;">\${Math.round(item.confidence * 100)}%</span>
          <span class="time">\${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
      \`).join('');
    }

    function renderSafety(data) {
      const container = document.getElementById('safety');
      if (!data.events || data.events.length === 0) {
        container.innerHTML = '<div class="card"><div class="no-data">No safety events detected - all parameters within bounds</div></div>';
        return;
      }

      container.innerHTML = data.events.map(event => \`
        <div class="safety-item \${event.type}">
          <div class="icon">\${event.type === 'cap' ? '⚡' : '🛡️'}</div>
          <div class="details">
            <div class="title">\${event.description}</div>
            <div class="desc">\${event.merchantId} / \${event.itemId} | \${new Date(event.timestamp).toLocaleString()}</div>
          </div>
        </div>
      \`).join('');
    }

    fetchData();
    setInterval(fetchData, 10000);
  </script>
</body>
</html>
  `);
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
        // Extract merchant/item from original payload
        const merchantId = data.merchant_id || data.merchantId || 'default';
        const itemId = data.item_id || data.itemId || 'default';
        // Lightweight check: Process any aged pending feedback for this merchant/item
        // This provides immediate feedback for high-traffic items while the scheduler handles the rest
        setImmediate(async () => {
            try {
                const timeoutThreshold = new Date(Date.now() - LEARNING_CONFIG.ignoredTimeoutHours * 60 * 60 * 1000);
                const agedFeedback = await Feedback.findOne({
                    outcome: 'pending',
                    merchantId,
                    itemId,
                    createdAt: { $lt: timeoutThreshold },
                });
                if (agedFeedback) {
                    log('[BACKGROUND] Processing aged pending feedback', {
                        correlationId: agedFeedback.correlationId,
                        merchantId,
                        itemId,
                    });
                    await processIgnoredFeedback();
                }
            }
            catch (err) {
                log('[BACKGROUND IGNORED CHECK ERROR]', { error: err instanceof Error ? err.message : String(err) });
            }
        });
        // Calculate modification direction and delta percent
        let modificationDirection = 'neutral';
        let deltaPercent = 0;
        if (data.modifications && data.modifications.suggested && data.modifications.final) {
            const suggestedQty = data.modifications.suggested.quantity || data.modifications.suggested;
            const finalQty = data.modifications.final.quantity || data.modifications.final;
            if (suggestedQty > 0) {
                deltaPercent = ((finalQty - suggestedQty) / suggestedQty) * 100;
                if (finalQty > suggestedQty) {
                    modificationDirection = 'up';
                }
                else if (finalQty < suggestedQty) {
                    modificationDirection = 'down';
                }
            }
        }
        const feedback = new Feedback({
            correlationId: data.correlation_id,
            decision: data.decision,
            confidence: confidence,
            outcome: data.outcome || 'approved',
            actionTaken: data.action_taken,
            latencyMs: data.latency_ms || 0,
            modifications: data.modifications,
            modificationDirection,
            deltaPercent,
            feedbackType: data.feedback_type || 'explicit',
            source: data.source || 'api',
            decisionCreatedAt: data.decision_created_at ? new Date(data.decision_created_at) : undefined,
            feedbackReceivedAt: new Date(),
            learningSignal,
            merchantId,
            itemId,
            processed: false,
            learningEmitted: false,
        });
        await feedback.save();
        log('[FEEDBACK STORED]', { feedbackId: feedback._id, outcome: feedback.outcome, modificationDirection, deltaPercent });
        // === ROUTE FEEDBACK TO ACTION ENGINE ===
        try {
            const approved = feedback.outcome === 'approved';
            await axios_1.default.post('http://localhost:4009/webhook/feedback', {
                correlationId: data.correlation_id,
                approved: approved,
                merchantId: merchantId,
                itemId: itemId,
                eventType: 'inventory.low',
                outcome: feedback.outcome,
                modificationDelta: deltaPercent,
            }, { timeout: 3000 });
            log('[FEEDBACK ROUTED TO ACTION ENGINE]', { correlationId: data.correlation_id, approved, outcome: feedback.outcome, deltaPercent });
        }
        catch (routeError) {
            log('[FEEDBACK ROUTE ERROR]', { error: routeError.message });
        }
        // === LEARNING: Update learned parameters with modification analysis ===
        await updateLearnedParameters(merchantId, itemId, feedback.outcome, data.modifications, modificationDirection, deltaPercent);
        // === EMIT LEARNING EVENT ===
        const learningEvent = {
            event: 'feedback.recorded',
            correlation_id: data.correlation_id,
            decision: data.decision,
            confidence: confidence,
            outcome: feedback.outcome,
            learningSignal,
            merchantId,
            itemId,
            timestamp: Date.now(),
            data: {
                originalSuggestion: data.suggested,
                userAction: data.final || data.action_taken,
                modifications: data.modifications,
                latencyMs: feedback.latencyMs,
            },
        };
        try {
            await axios_1.default.post(`${EVENT_PLATFORM_URL}/events/feedback.recorded`, learningEvent, {
                timeout: 5000,
            });
            feedback.learningEmitted = true;
            await feedback.save();
            log('[LEARNING EVENT EMITTED]', { correlationId: data.correlation_id });
        }
        catch (emitError) {
            log('[LEARNING EVENT FAILED]', { error: emitError.message });
        }
        // === GET UPDATED LEARNED PARAMS ===
        const learnedParams = await LearnedParams.findOne({ merchantId, itemId });
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('[LEARNING COMPLETE]', {
            feedbackId: feedback._id,
            outcome: feedback.outcome,
            newConfidence: learningSignal.confidenceAdjusted,
            learnedMultiplier: learnedParams?.quantityMultiplier || 1.0,
        });
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        res.json({
            success: true,
            feedbackId: feedback._id,
            correlationId: feedback.correlationId,
            outcome: feedback.outcome,
            modificationDirection,
            deltaPercent,
            learningSignal,
            learnedParams: learnedParams ? {
                confidenceBias: learnedParams.confidenceBias,
                quantityMultiplier: learnedParams.quantityMultiplier,
                approvalRate: learnedParams.approvalRate,
            } : null,
        });
    }
    catch (error) {
        log('[ERROR]', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Helper function to clamp value within bounds
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
// Helper function to apply EWMA update
function ewmaUpdate(currentValue, newValue, alpha) {
    return currentValue * (1 - alpha) + newValue * alpha;
}
// Update learned parameters based on feedback with enhanced modification analysis
async function updateLearnedParameters(merchantId, itemId, outcome, modifications, modificationDirection, deltaPercent) {
    try {
        let params = await LearnedParams.findOne({ merchantId, itemId });
        if (!params) {
            params = new LearnedParams({
                merchantId,
                itemId,
                confidenceBias: 0,
                quantityMultiplier: 1.0,
                approvalRate: 0,
                totalDecisions: 0,
                learningVersion: 1,
                learningHistory: [],
            });
        }
        params.totalDecisions += 1;
        params.lastUpdated = new Date();
        // Store previous values for history tracking
        const previousMultiplier = params.quantityMultiplier;
        const previousBias = params.confidenceBias;
        let adjustmentReason = 'no_change';
        let weightedAdjustment = 0;
        let parsedDirection = modificationDirection || 'neutral';
        let parsedDelta = deltaPercent || 0;
        // GUARDRAIL 1: Minimum samples requirement
        // Only update parameters after collecting minimum samples
        if (params.totalDecisions <= LEARNING_CONFIG.minSamplesBeforeUpdate) {
            log('[GUARDRAIL] Minimum samples not met', {
                merchantId,
                itemId,
                currentSamples: params.totalDecisions,
                requiredSamples: LEARNING_CONFIG.minSamplesBeforeUpdate,
            });
            await params.save();
            return params;
        }
        // GUARDRAIL 2: EWMA-style learning rate (alpha = 0.15)
        const alpha = LEARNING_CONFIG.ewmaAlpha;
        const modAlpha = LEARNING_CONFIG.modificationAlpha;
        // Parse modification direction and delta from modifications if not provided
        if (!parsedDirection && modifications && modifications.suggested && modifications.final) {
            const suggestedQty = modifications.suggested.quantity || modifications.suggested;
            const finalQty = modifications.final.quantity || modifications.final;
            if (suggestedQty > 0) {
                // Calculate delta percent (capped at maxDeltaPercent)
                const rawDelta = ((finalQty - suggestedQty) / suggestedQty) * 100;
                parsedDelta = clamp(Math.abs(rawDelta), 0, LEARNING_CONFIG.maxDeltaPercent);
                // Determine modification direction
                if (finalQty > suggestedQty) {
                    parsedDirection = 'up';
                }
                else if (finalQty < suggestedQty) {
                    parsedDirection = 'down';
                }
                else {
                    parsedDirection = 'neutral';
                }
            }
        }
        // Update based on outcome with EWMA learning
        if (outcome === 'approved') {
            params.approvalRate = ewmaUpdate(params.approvalRate, 1, alpha);
            // EWMA-style bias update with smaller step
            const biasDelta = 0.01 * alpha;
            params.confidenceBias = ewmaUpdate(params.confidenceBias, params.confidenceBias + biasDelta, alpha);
            adjustmentReason = 'approved_signal';
        }
        else if (outcome === 'rejected') {
            params.approvalRate = ewmaUpdate(params.approvalRate, 0, alpha);
            // EWMA-style bias update with smaller step
            const biasDelta = 0.02 * alpha;
            params.confidenceBias = ewmaUpdate(params.confidenceBias, params.confidenceBias - biasDelta, alpha);
            adjustmentReason = 'rejected_signal';
        }
        else if (outcome === 'ignored') {
            // Soft negative signal for ignored feedback (partial signal)
            // Apply reduced weight to the ignored signal so it doesn't heavily penalize decisions
            params.approvalRate = ewmaUpdate(params.approvalRate, 0.5, alpha * LEARNING_CONFIG.ignoredSignalMultiplier);
            // Apply very small bias adjustment for ignored feedback
            const biasDelta = 0.005 * alpha * LEARNING_CONFIG.ignoredSignalMultiplier;
            params.confidenceBias = ewmaUpdate(params.confidenceBias, params.confidenceBias - biasDelta, alpha);
            adjustmentReason = 'ignored_signal';
            log('[DECISION BECAME IGNORED]', {
                merchantId,
                itemId,
                reason: 'timeout_24h',
                signalMultiplier: LEARNING_CONFIG.ignoredSignalMultiplier,
            });
        }
        // GUARDRAIL 4: Confidence bias bounds [-0.2, 0.2]
        params.confidenceBias = clamp(params.confidenceBias, LEARNING_CONFIG.confidenceBiasBounds.min, LEARNING_CONFIG.confidenceBiasBounds.max);
        // ENHANCED MODIFICATION ANALYSIS:
        // Weight = |delta_percent| * alpha
        // If modified_up: increase multiplier slightly
        // If modified_down: decrease multiplier slightly
        if (parsedDirection !== 'neutral' && parsedDelta > LEARNING_CONFIG.deltaPercentThreshold) {
            // Calculate weighted adjustment based on delta magnitude
            // Weight ranges from 0 to maxDeltaPercent * alpha
            const deltaWeight = (parsedDelta / LEARNING_CONFIG.maxDeltaPercent) * modAlpha;
            if (parsedDirection === 'up') {
                // User increased quantity - learn that they prefer more
                // Small positive adjustment weighted by how much they changed
                const multiplierBoost = 0.05 * deltaWeight;
                params.quantityMultiplier = ewmaUpdate(params.quantityMultiplier, params.quantityMultiplier + multiplierBoost, alpha);
                adjustmentReason = 'modified_up';
            }
            else if (parsedDirection === 'down') {
                // User decreased quantity - learn that they prefer less
                // Small negative adjustment weighted by how much they changed
                const multiplierReduction = 0.05 * deltaWeight;
                params.quantityMultiplier = ewmaUpdate(params.quantityMultiplier, params.quantityMultiplier - multiplierReduction, alpha);
                adjustmentReason = 'modified_down';
            }
            weightedAdjustment = parsedDirection === 'up' ? deltaWeight : -deltaWeight;
            // Update modification patterns for this merchant/item
            await updateModificationPatterns(merchantId, itemId, parsedDirection, parsedDelta);
            log('[MODIFICATION SIGNAL PROCESSED]', {
                merchantId,
                itemId,
                direction: parsedDirection,
                deltaPercent: parsedDelta,
                weight: deltaWeight,
                newMultiplier: params.quantityMultiplier,
            });
        }
        else if (modifications && modifications.suggested && modifications.final) {
            // Legacy handling for simple ratio-based updates
            const suggestedQty = modifications.suggested.quantity || modifications.suggested;
            const finalQty = modifications.final.quantity || modifications.final;
            if (suggestedQty > 0) {
                const ratio = finalQty / suggestedQty;
                // Apply EWMA-style update to multiplier
                params.quantityMultiplier = ewmaUpdate(params.quantityMultiplier, ratio, alpha);
                adjustmentReason = adjustmentReason === 'no_change' ? 'quantity_modified' : adjustmentReason + '_with_modification';
            }
        }
        // GUARDRAIL 3: Apply bounds [0.8, 1.3]
        params.quantityMultiplier = clamp(params.quantityMultiplier, LEARNING_CONFIG.multiplierBounds.min, LEARNING_CONFIG.multiplierBounds.max);
        // GUARDRAIL 5: Track learning version/history with modification details
        params.learningVersion += 1;
        params.learningHistory.push({
            timestamp: new Date(),
            outcome,
            previousMultiplier,
            newMultiplier: params.quantityMultiplier,
            previousBias,
            newBias: params.confidenceBias,
            adjustmentReason,
            modificationDirection: parsedDirection,
            deltaPercent: parsedDelta,
            weightedAdjustment,
        });
        // Keep only the last 100 history entries to prevent unbounded growth
        if (params.learningHistory.length > 100) {
            params.learningHistory = params.learningHistory.slice(-100);
        }
        await params.save();
        log('[PARAMS UPDATED WITH GUARDRAILS]', {
            merchantId,
            itemId,
            multiplier: params.quantityMultiplier,
            bias: params.confidenceBias,
            approvalRate: params.approvalRate,
            totalDecisions: params.totalDecisions,
            learningVersion: params.learningVersion,
            adjustmentReason,
            modificationDirection: parsedDirection,
            deltaPercent: parsedDelta,
        });
        return params;
    }
    catch (error) {
        log('[PARAMS UPDATE ERROR]', { error: error.message });
        return null;
    }
}
// Update modification patterns for a merchant/item
async function updateModificationPatterns(merchantId, itemId, direction, delta) {
    try {
        let pattern = await ModificationPattern.findOne({ merchantId, itemId });
        if (!pattern) {
            pattern = new ModificationPattern({
                merchantId,
                itemId,
                modifiedUpCount: 0,
                modifiedDownCount: 0,
                modifiedNeutralCount: 0,
                deltaSum: 0,
                deltaSquaredSum: 0,
                minDelta: Infinity,
                maxDelta: -Infinity,
                avgDeltaEwma: 0,
                totalModifications: 0,
            });
        }
        // Update direction counts
        if (direction === 'up') {
            pattern.modifiedUpCount += 1;
        }
        else if (direction === 'down') {
            pattern.modifiedDownCount += 1;
        }
        else {
            pattern.modifiedNeutralCount += 1;
        }
        // Update delta statistics
        pattern.deltaSum += delta;
        pattern.deltaSquaredSum += delta * delta;
        pattern.minDelta = Math.min(pattern.minDelta === Infinity ? delta : pattern.minDelta, delta);
        pattern.maxDelta = Math.max(pattern.maxDelta === -Infinity ? delta : pattern.maxDelta, delta);
        pattern.totalModifications += 1;
        // Update EWMA average delta
        const modAlpha = LEARNING_CONFIG.modificationAlpha;
        pattern.avgDeltaEwma = ewmaUpdate(pattern.avgDeltaEwma, delta, modAlpha);
        pattern.lastUpdated = new Date();
        await pattern.save();
        return pattern;
    }
    catch (error) {
        log('[MODIFICATION PATTERN UPDATE ERROR]', { error: error.message });
        return null;
    }
}
function calculateLearningSignal(data) {
    const { outcome, confidence } = data;
    let accuracyDelta = 0;
    let confidenceAdjusted = confidence || 0.5;
    let modificationWeightedDelta = 0;
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
        if (data.modifications) {
            const suggested = data.modifications.suggested;
            const final = data.modifications.final;
            if (suggested && final) {
                const suggestedQty = typeof suggested === 'object' ? suggested.quantity : suggested;
                const finalQty = typeof final === 'object' ? final.quantity : final;
                if (suggestedQty > 0) {
                    const deltaPercent = Math.abs(((finalQty - suggestedQty) / suggestedQty) * 100);
                    confidenceAdjusted = confidence - (deltaPercent / 100) * 0.1;
                    // Calculate weighted delta for learning: weight = |delta_percent| * modificationAlpha
                    modificationWeightedDelta = (deltaPercent / LEARNING_CONFIG.maxDeltaPercent) * LEARNING_CONFIG.modificationAlpha;
                }
            }
        }
    }
    else if (outcome === 'ignored') {
        // Soft negative signal for ignored feedback
        // Partial signal: confidence -= 0.02, but don't affect multiplier much
        accuracyDelta = -0.02 * LEARNING_CONFIG.ignoredSignalMultiplier;
        confidenceAdjusted = Math.max(0, confidence - LEARNING_CONFIG.ignoredConfidencePenalty);
    }
    return {
        accuracyDelta: Math.round(accuracyDelta * 1000) / 1000,
        confidenceAdjusted: Math.round(Math.max(0, Math.min(1, confidenceAdjusted)) * 1000) / 1000,
        modificationWeightedDelta: Math.round(modificationWeightedDelta * 1000) / 1000,
    };
}
// Process pending feedback that has timed out (24 hours)
async function processIgnoredFeedback() {
    const errors = [];
    let processedCount = 0;
    try {
        const timeoutThreshold = new Date(Date.now() - LEARNING_CONFIG.ignoredTimeoutHours * 60 * 60 * 1000);
        // Find all pending feedback older than 24 hours
        const pendingFeedback = await Feedback.find({
            outcome: 'pending',
            createdAt: { $lt: timeoutThreshold },
        });
        log('[IGNORED FEEDBACK SCAN]', {
            pendingCount: pendingFeedback.length,
            thresholdHours: LEARNING_CONFIG.ignoredTimeoutHours,
            threshold: timeoutThreshold.toISOString(),
        });
        for (const feedback of pendingFeedback) {
            try {
                const previousOutcome = feedback.outcome;
                const merchantId = feedback.merchantId || 'default';
                const itemId = feedback.itemId || 'default';
                // Calculate learning signal for ignored outcome
                const learningSignal = calculateLearningSignal({
                    outcome: 'ignored',
                    confidence: feedback.confidence || 0.5,
                });
                // Update feedback record
                feedback.outcome = 'ignored';
                feedback.ignoredAt = new Date();
                feedback.ignoredReason = 'timeout_24h';
                feedback.feedbackType = 'implicit';
                feedback.learningSignal = learningSignal;
                feedback.feedbackReceivedAt = new Date();
                feedback.processed = false;
                feedback.learningEmitted = false;
                await feedback.save();
                // Update learned parameters with soft negative signal
                await updateLearnedParameters(merchantId, itemId, 'ignored', null, feedback.confidence);
                // Emit learning event
                const learningEvent = {
                    event: 'feedback.ignored',
                    correlation_id: feedback.correlationId,
                    decision: feedback.decision,
                    confidence: feedback.confidence,
                    outcome: 'ignored',
                    ignoredReason: 'timeout_24h',
                    learningSignal,
                    merchantId,
                    itemId,
                    timestamp: Date.now(),
                    data: {
                        decisionCreatedAt: feedback.decisionCreatedAt,
                        ignoredAt: feedback.ignoredAt,
                        timeoutHours: LEARNING_CONFIG.ignoredTimeoutHours,
                    },
                };
                try {
                    await axios_1.default.post(`${EVENT_PLATFORM_URL}/events/feedback.ignored`, learningEvent, {
                        timeout: 5000,
                    });
                    feedback.learningEmitted = true;
                    await feedback.save();
                }
                catch (emitError) {
                    log('[IGNORED EVENT EMIT FAILED]', { correlationId: feedback.correlationId, error: emitError.message });
                }
                log('[FEEDBACK IGNORED]', {
                    correlationId: feedback.correlationId,
                    merchantId,
                    itemId,
                    previousOutcome,
                    newOutcome: 'ignored',
                    ignoredReason: 'timeout_24h',
                    confidence: feedback.confidence,
                    learningSignal,
                });
                processedCount++;
            }
            catch (error) {
                const errorMsg = `Failed to process ignored feedback ${feedback.correlationId}: ${error.message}`;
                log('[IGNORED FEEDBACK ERROR]', { correlationId: feedback.correlationId, error: error.message });
                errors.push(errorMsg);
            }
        }
        log('[IGNORED FEEDBACK PROCESSING COMPLETE]', {
            processedCount,
            errors: errors.length,
        });
        return { processedCount, errors };
    }
    catch (error) {
        log('[IGNORED FEEDBACK SCAN ERROR]', { error: error.message });
        return { processedCount: 0, errors: [error.message] };
    }
}
// Endpoint to manually trigger ignored feedback processing
app.post('/process-ignored', async (req, res) => {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('[MANUAL IGNORED FEEDBACK PROCESSING TRIGGERED]');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await processIgnoredFeedback();
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('[IGNORED FEEDBACK PROCESSING RESULT]', {
            processedCount: result.processedCount,
            errors: result.errors.length,
        });
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        res.json({
            success: true,
            processedCount: result.processedCount,
            errors: result.errors,
        });
    }
    catch (error) {
        log('[PROCESS IGNORED ERROR]', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get pending feedback count (for monitoring)
app.get('/pending-count', async (req, res) => {
    try {
        const timeoutThreshold = new Date(Date.now() - LEARNING_CONFIG.ignoredTimeoutHours * 60 * 60 * 1000);
        const pendingTotal = await Feedback.countDocuments({ outcome: 'pending' });
        const pendingAged = await Feedback.countDocuments({
            outcome: 'pending',
            createdAt: { $lt: timeoutThreshold },
        });
        res.json({
            pendingTotal,
            pendingAged,
            timeoutHours: LEARNING_CONFIG.ignoredTimeoutHours,
            threshold: timeoutThreshold.toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get learned parameters
app.get('/learned-params/:merchantId/:itemId', async (req, res) => {
    try {
        const params = await LearnedParams.findOne({
            merchantId: req.params.merchantId,
            itemId: req.params.itemId,
        });
        if (!params) {
            return res.json({
                found: false,
                defaults: {
                    confidenceBias: 0,
                    quantityMultiplier: 1.0,
                    approvalRate: 0,
                },
            });
        }
        res.json({
            found: true,
            params: {
                merchantId: params.merchantId,
                itemId: params.itemId,
                confidenceBias: params.confidenceBias,
                quantityMultiplier: params.quantityMultiplier,
                approvalRate: params.approvalRate,
                totalDecisions: params.totalDecisions,
                lastUpdated: params.lastUpdated,
                learningVersion: params.learningVersion,
                learningHistory: params.learningHistory.slice(-10), // Last 10 entries
            },
            config: LEARNING_CONFIG,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
// Learning insights
app.get('/learn/:correlationId', async (req, res) => {
    try {
        const feedback = await Feedback.findOne({ correlationId: req.params.correlationId });
        if (!feedback) {
            return res.status(404).json({ error: 'Not found' });
        }
        const insight = {
            correlationId: feedback.correlationId,
            outcome: feedback.outcome,
            confidence: feedback.confidence,
            learningSignal: feedback.learningSignal,
            modificationDirection: feedback.modificationDirection,
            deltaPercent: feedback.deltaPercent,
            feedbackType: feedback.feedbackType,
            ignoredAt: feedback.ignoredAt,
            ignoredReason: feedback.ignoredReason,
            verdict: feedback.outcome === 'approved' ? 'POSITIVE_SIGNAL' :
                feedback.outcome === 'rejected' ? 'NEGATIVE_SIGNAL' :
                    feedback.outcome === 'modified' ? 'PARTIAL_SIGNAL' :
                        feedback.outcome === 'ignored' ? 'SOFT_NEGATIVE_SIGNAL' : 'PENDING',
        };
        res.json({ insight });
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
        // Calculate ignored count and rate
        const ignoredCount = byOutcome.find(o => o._id === 'ignored')?.count || 0;
        const ignoredRate = total > 0 ? Math.round((ignoredCount / total) * 1000) / 10 : 0;
        // Calculate pending count and rate
        const pendingCount = byOutcome.find(o => o._id === 'pending')?.count || 0;
        const pendingRate = total > 0 ? Math.round((pendingCount / total) * 1000) / 10 : 0;
        const avgLatency = await Feedback.aggregate([
            { $match: { latencyMs: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$latencyMs' } } }
        ]);
        const learningEmitted = await Feedback.countDocuments({ learningEmitted: true });
        const learnedParams = await LearnedParams.countDocuments();
        res.json({
            total,
            byOutcome,
            avgLatencyMs: avgLatency[0]?.avg || 0,
            learningEmitted,
            learnedParamsCount: learnedParams,
            // Ignored feedback stats
            ignoredCount,
            ignoredRate,
            // Pending feedback stats
            pendingCount,
            pendingRate,
            // Learning config for reference
            ignoredTimeoutHours: LEARNING_CONFIG.ignoredTimeoutHours,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Modification Analysis
app.get('/modification-stats', async (req, res) => {
    try {
        const recentFeedback = await Feedback.find({ modifications: { $exists: true, $ne: null } })
            .sort({ feedbackReceivedAt: -1 })
            .limit(100)
            .lean();
        let modifiedUp = 0;
        let modifiedDown = 0;
        let totalDelta = 0;
        let deltaCount = 0;
        recentFeedback.forEach(fb => {
            if (fb.modifications) {
                const suggested = typeof fb.modifications.suggested === 'object'
                    ? fb.modifications.suggested.quantity
                    : fb.modifications.suggested;
                const final = typeof fb.modifications.final === 'object'
                    ? fb.modifications.final.quantity
                    : fb.modifications.final;
                if (suggested && final && suggested > 0) {
                    const delta = ((final - suggested) / suggested) * 100;
                    if (delta > 0)
                        modifiedUp++;
                    else if (delta < 0)
                        modifiedDown++;
                    totalDelta += delta;
                    deltaCount++;
                }
            }
        });
        res.json({
            modifiedUp,
            modifiedDown,
            avgDeltaPercent: deltaCount > 0 ? Math.round((totalDelta / deltaCount) * 100) / 100 : 0,
            totalWithModifications: recentFeedback.length,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Detailed Modification Stats with histogram
app.get('/stats/modifications', async (req, res) => {
    try {
        const merchantId = req.query.merchantId;
        const itemId = req.query.itemId;
        // Build query filter
        const feedbackFilter = {};
        if (merchantId)
            feedbackFilter.merchantId = merchantId;
        if (itemId)
            feedbackFilter.itemId = itemId;
        // Get direction counts from feedback collection
        const directionCounts = await Feedback.aggregate([
            { $match: { ...feedbackFilter, modificationDirection: { $in: ['up', 'down', 'neutral'] } } },
            { $group: { _id: '$modificationDirection', count: { $sum: 1 } } }
        ]);
        const modifiedUpCount = directionCounts.find(d => d._id === 'up')?.count || 0;
        const modifiedDownCount = directionCounts.find(d => d._id === 'down')?.count || 0;
        const modifiedNeutralCount = directionCounts.find(d => d._id === 'neutral')?.count || 0;
        const totalModifications = modifiedUpCount + modifiedDownCount + modifiedNeutralCount;
        // Get delta statistics
        const deltaStats = await Feedback.aggregate([
            { $match: { ...feedbackFilter, deltaPercent: { $exists: true, $ne: 0 } } },
            { $group: {
                    _id: null,
                    avgDelta: { $avg: '$deltaPercent' },
                    minDelta: { $min: '$deltaPercent' },
                    maxDelta: { $max: '$deltaPercent' },
                    count: { $sum: 1 }
                } }
        ]);
        const avgDeltaPercent = deltaStats[0]?.avgDelta || 0;
        const minDelta = deltaStats[0]?.minDelta || 0;
        const maxDelta = deltaStats[0]?.maxDelta || 0;
        const deltaStdDev = await calculateDeltaStdDev(feedbackFilter);
        // Build delta distribution histogram
        const histogram = await buildDeltaHistogram(feedbackFilter);
        // Get top patterns by merchant/item
        const topPatterns = await ModificationPattern.aggregate([
            { $match: merchantId ? { merchantId } : {} },
            { $sort: { totalModifications: -1 } },
            { $limit: 10 },
            { $project: {
                    merchantId: 1,
                    itemId: 1,
                    modifiedUpCount: 1,
                    modifiedDownCount: 1,
                    modifiedNeutralCount: 1,
                    avgDeltaEwma: 1,
                    totalModifications: 1,
                    directionBias: { $subtract: ['$modifiedUpCount', '$modifiedDownCount'] }
                } }
        ]);
        res.json({
            summary: {
                totalModifications,
                modifiedUpCount,
                modifiedDownCount,
                modifiedNeutralCount,
                upRatio: totalModifications > 0 ? Math.round((modifiedUpCount / totalModifications) * 1000) / 10 : 0,
                downRatio: totalModifications > 0 ? Math.round((modifiedDownCount / totalModifications) * 1000) / 10 : 0,
                neutralRatio: totalModifications > 0 ? Math.round((modifiedNeutralCount / totalModifications) * 1000) / 10 : 0,
            },
            deltaStatistics: {
                averageDeltaPercent: Math.round(avgDeltaPercent * 100) / 100,
                minDeltaPercent: Math.round(minDelta * 100) / 100,
                maxDeltaPercent: Math.round(maxDelta * 100) / 100,
                stdDevDelta: Math.round(deltaStdDev * 100) / 100,
            },
            deltaDistribution: histogram,
            topPatterns,
            filters: {
                merchantId: merchantId || 'all',
                itemId: itemId || 'all',
            },
            learningConfig: {
                modificationAlpha: LEARNING_CONFIG.modificationAlpha,
                deltaPercentThreshold: LEARNING_CONFIG.deltaPercentThreshold,
                maxDeltaPercent: LEARNING_CONFIG.maxDeltaPercent,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Calculate standard deviation of delta values
async function calculateDeltaStdDev(filter) {
    try {
        const stats = await Feedback.aggregate([
            { $match: { ...filter, deltaPercent: { $exists: true, $ne: 0 } } },
            { $group: {
                    _id: null,
                    count: { $sum: 1 },
                    sum: { $sum: '$deltaPercent' },
                    sumSq: { $sum: { $pow: ['$deltaPercent', 2] } }
                } }
        ]);
        if (!stats[0] || stats[0].count < 2)
            return 0;
        const mean = stats[0].sum / stats[0].count;
        const variance = (stats[0].sumSq / stats[0].count) - (mean * mean);
        return Math.sqrt(Math.max(0, variance));
    }
    catch (error) {
        return 0;
    }
}
// Build delta distribution histogram
async function buildDeltaHistogram(filter) {
    try {
        const buckets = [
            { label: '<-100%', min: -Infinity, max: -100, count: 0 },
            { label: '-100% to -50%', min: -100, max: -50, count: 0 },
            { label: '-50% to -20%', min: -50, max: -20, count: 0 },
            { label: '-20% to -10%', min: -20, max: -10, count: 0 },
            { label: '-10% to -5%', min: -10, max: -5, count: 0 },
            { label: '-5% to 0%', min: -5, max: 0, count: 0 },
            { label: '0% to 5%', min: 0, max: 5, count: 0 },
            { label: '5% to 10%', min: 5, max: 10, count: 0 },
            { label: '10% to 20%', min: 10, max: 20, count: 0 },
            { label: '20% to 50%', min: 20, max: 50, count: 0 },
            { label: '50% to 100%', min: 50, max: 100, count: 0 },
            { label: '>100%', min: 100, max: Infinity, count: 0 },
        ];
        const feedbacks = await Feedback.find({ ...filter, deltaPercent: { $exists: true, $ne: 0 } })
            .select('deltaPercent')
            .lean();
        for (const feedback of feedbacks) {
            const delta = feedback.deltaPercent;
            for (const bucket of buckets) {
                if (delta >= bucket.min && delta < bucket.max) {
                    bucket.count++;
                    break;
                }
            }
        }
        return buckets;
    }
    catch (error) {
        return [];
    }
}
// Lift Chart Data
app.get('/lift-data', async (req, res) => {
    try {
        const totalFeedback = await Feedback.countDocuments();
        const approvedFeedback = await Feedback.countDocuments({ outcome: 'approved' });
        const baselineRate = 50;
        const adaptiveRate = totalFeedback > 0 ? (approvedFeedback / totalFeedback) * 100 : 0;
        const lift = baselineRate > 0 ? ((adaptiveRate - baselineRate) / baselineRate) * 100 : 0;
        res.json({
            adaptiveRate: Math.round(adaptiveRate * 10) / 10,
            baselineRate: Math.round(baselineRate * 10) / 10,
            lift: Math.round(lift * 10) / 10,
            adaptiveApprovals: approvedFeedback,
            adaptiveTotal: totalFeedback,
            hasEnoughData: totalFeedback >= 10,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Decision Timeline
app.get('/decision-timeline', async (req, res) => {
    try {
        const recent = await Feedback.find()
            .sort({ feedbackReceivedAt: -1 })
            .limit(10)
            .select('correlationId outcome confidence feedbackReceivedAt latencyMs')
            .lean();
        const timeline = recent.map(fb => ({
            correlationId: fb.correlationId?.substring(0, 12) + '...',
            fullId: fb.correlationId,
            outcome: fb.outcome,
            confidence: fb.confidence,
            timestamp: fb.feedbackReceivedAt,
            latencyMs: fb.latencyMs,
        }));
        res.json({ timeline });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Safety Events
app.get('/safety-events', async (req, res) => {
    try {
        const allParams = await LearnedParams.find().lean();
        const safetyEvents = [];
        allParams.forEach(p => {
            if (p.quantityMultiplier <= LEARNING_CONFIG.multiplierBounds.min ||
                p.quantityMultiplier >= LEARNING_CONFIG.multiplierBounds.max) {
                safetyEvents.push({
                    type: 'cap',
                    merchantId: p.merchantId,
                    itemId: p.itemId,
                    value: p.quantityMultiplier,
                    bounds: LEARNING_CONFIG.multiplierBounds,
                    timestamp: p.lastUpdated,
                    description: `Multiplier capped at ${p.quantityMultiplier}`,
                });
            }
            if (p.confidenceBias <= LEARNING_CONFIG.confidenceBiasBounds.min ||
                p.confidenceBias >= LEARNING_CONFIG.confidenceBiasBounds.max) {
                safetyEvents.push({
                    type: 'block',
                    merchantId: p.merchantId,
                    itemId: p.itemId,
                    value: p.confidenceBias,
                    bounds: LEARNING_CONFIG.confidenceBiasBounds,
                    timestamp: p.lastUpdated,
                    description: `Bias at boundary ${p.confidenceBias}`,
                });
            }
        });
        safetyEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json({
            events: safetyEvents.slice(0, 10),
            totalEvents: safetyEvents.length,
            config: {
                multiplierBounds: LEARNING_CONFIG.multiplierBounds,
                confidenceBiasBounds: LEARNING_CONFIG.confidenceBiasBounds,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Full loop test
app.get('/loop-test', async (req, res) => {
    const testId = `loop_test_${Date.now()}`;
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('[LOOP TEST STARTED]', { testId });
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // Step 1: Send event
    log('[STEP 1] Sending inventory.low event...');
    const eventResponse = await axios_1.default.post(`${EVENT_PLATFORM_URL}/events/inventory.low`, {
        event: 'inventory.low',
        correlation_id: testId,
        source: 'loop-test',
        data: {
            merchant_id: 'test_merchant',
            item_id: 'test_item',
            item_name: 'Test Item',
            current_stock: 2,
            threshold: 5,
        },
    });
    log('[STEP 1 COMPLETE] Event sent', { eventId: eventResponse.data.eventId });
    // Wait for processing
    await new Promise(r => setTimeout(r, 2000));
    // Step 2: Submit feedback
    log('[STEP 2] Submitting feedback...');
    const feedbackResponse = await axios_1.default.post(`http://localhost:${PORT}/feedback`, {
        correlation_id: testId,
        decision: 'draft_po_suggested',
        confidence: 0.82,
        outcome: 'approved',
        merchant_id: 'test_merchant',
        item_id: 'test_item',
        suggested: { quantity: 10 },
        final: { quantity: 12 },
        modifications: {
            suggested: { quantity: 10 },
            final: { quantity: 12 },
        },
    });
    log('[STEP 2 COMPLETE] Feedback recorded', { feedbackId: feedbackResponse.data.feedbackId });
    // Step 3: Check learned params
    await new Promise(r => setTimeout(r, 1000));
    const paramsResponse = await axios_1.default.get(`http://localhost:${PORT}/learned-params/test_merchant/test_item`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('[LOOP TEST COMPLETE]', {
        testId,
        outcome: feedbackResponse.data.outcome,
        newMultiplier: paramsResponse.data.params?.quantityMultiplier,
        newBias: paramsResponse.data.params?.confidenceBias,
    });
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    res.json({
        success: true,
        testId,
        event: eventResponse.data,
        feedback: feedbackResponse.data,
        learnedParams: paramsResponse.data,
    });
});
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
async function start() {
    try {
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('Starting REZ Feedback Service (LEARNING MODE)');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('Connecting to MongoDB...');
        await mongoose_1.default.connect(MONGODB_URI);
        log('MongoDB connected');
        log('Event Platform:', EVENT_PLATFORM_URL);
        // Start the scheduled job for processing ignored feedback
        startIgnoredFeedbackScheduler();
        app.listen(PORT, () => {
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('Feedback Service started', { port: PORT });
            log('Health: http://localhost:' + PORT + '/health');
            log('Stats: http://localhost:' + PORT + '/stats');
            log('Loop Test: GET http://localhost:' + PORT + '/loop-test');
            log('Process Ignored: POST http://localhost:' + PORT + '/process-ignored');
            log('Pending Count: GET http://localhost:' + PORT + '/pending-count');
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });
    }
    catch (error) {
        log('[FATAL]', { error: error.message });
        process.exit(1);
    }
}
// Scheduled job to process ignored feedback every hour
function startIgnoredFeedbackScheduler() {
    const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    log('[SCHEDULER] Starting ignored feedback processor', {
        intervalMs: INTERVAL_MS,
        timeoutHours: LEARNING_CONFIG.ignoredTimeoutHours,
    });
    // Run immediately on startup
    setTimeout(async () => {
        try {
            const result = await processIgnoredFeedback();
            if (result.processedCount > 0) {
                log('[SCHEDULER] Initial ignored feedback scan complete', {
                    processedCount: result.processedCount,
                });
            }
        }
        catch (error) {
            log('[SCHEDULER ERROR]', { error: error.message });
        }
    }, 5000); // Wait 5 seconds after startup
    // Run periodically
    setInterval(async () => {
        try {
            log('[SCHEDULER] Running scheduled ignored feedback scan...');
            const result = await processIgnoredFeedback();
            if (result.processedCount > 0) {
                log('[SCHEDULER] Ignored feedback processed', {
                    processedCount: result.processedCount,
                });
            }
        }
        catch (error) {
            log('[SCHEDULER ERROR]', { error: error.message });
        }
    }, INTERVAL_MS);
}
// ============================================================
// INSIGHT SYNTHESIS LAYER
// Transforms raw feedback into structured intelligence
// ============================================================
// Weekly Insights
app.get('/insights/weekly', async (req, res) => {
    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // Get all feedback from last week
        const weekFeedback = await Feedback.find({
            feedbackReceivedAt: { $gte: oneWeekAgo }
        }).lean();
        if (weekFeedback.length === 0) {
            return res.json({
                period: 'last_7_days',
                dataAvailable: false,
                message: 'No feedback data for analysis'
            });
        }
        // 1. Modification patterns by reason
        const reasonCounts = {};
        weekFeedback.forEach(fb => {
            if (fb.reasonCategory) {
                reasonCounts[fb.reasonCategory] = (reasonCounts[fb.reasonCategory] || 0) + 1;
            }
        });
        const topReasons = Object.entries(reasonCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([reason, count]) => ({ reason, count }));
        // 2. Delta patterns (normalize across scale)
        const deltaAnalysis = [];
        weekFeedback.forEach(fb => {
            if (fb.modifications && fb.deltaPercent !== undefined) {
                const suggested = typeof fb.modifications.suggested === 'object'
                    ? fb.modifications.suggested.quantity
                    : fb.modifications.suggested;
                const final = typeof fb.modifications.final === 'object'
                    ? fb.modifications.final.quantity
                    : fb.modifications.final;
                const absolute = Math.abs(final - suggested);
                const impactScore = suggested > 0 ? absolute / suggested : 0;
                deltaAnalysis.push({
                    merchantId: fb.merchantId,
                    deltaPercent: fb.deltaPercent,
                    deltaAbsolute: absolute,
                    impactScore,
                    direction: fb.deltaPercent >= 0 ? 'up' : 'down'
                });
            }
        });
        const avgDelta = deltaAnalysis.length > 0
            ? deltaAnalysis.reduce((sum, d) => sum + d.deltaPercent, 0) / deltaAnalysis.length
            : 0;
        const avgImpact = deltaAnalysis.length > 0
            ? deltaAnalysis.reduce((sum, d) => sum + d.impactScore, 0) / deltaAnalysis.length
            : 0;
        // 3. Merchant patterns
        const merchantPatterns = {};
        weekFeedback.forEach(fb => {
            if (fb.merchantId) {
                if (!merchantPatterns[fb.merchantId]) {
                    merchantPatterns[fb.merchantId] = {
                        merchantId: fb.merchantId,
                        decisions: 0,
                        modifications: 0,
                        approvals: 0,
                        rejections: 0,
                        avgDelta: 0,
                        deltas: []
                    };
                }
                const m = merchantPatterns[fb.merchantId];
                m.decisions++;
                if (fb.outcome === 'approved')
                    m.approvals++;
                if (fb.outcome === 'rejected')
                    m.rejections++;
                if (fb.outcome === 'modified') {
                    m.modifications++;
                    if (fb.deltaPercent !== undefined)
                        m.deltas.push(fb.deltaPercent);
                }
            }
        });
        // Calculate avg delta per merchant
        Object.values(merchantPatterns).forEach((m) => {
            m.avgDelta = m.deltas.length > 0
                ? m.deltas.reduce((a, b) => a + b, 0) / m.deltas.length
                : 0;
            m.modificationRate = m.decisions > 0 ? m.modifications / m.decisions : 0;
            m.approvalRate = m.decisions > 0 ? m.approvals / m.decisions : 0;
        });
        const topMerchantPatterns = Object.values(merchantPatterns)
            .sort((a, b) => b.decisions - a.decisions)
            .slice(0, 5);
        // 4. Context gaps
        const contextGaps = {};
        weekFeedback.forEach(fb => {
            if (fb.contextCompleteness?.missingFeatures) {
                fb.contextCompleteness.missingFeatures.forEach((f) => {
                    contextGaps[f] = (contextGaps[f] || 0) + 1;
                });
            }
        });
        const topContextGaps = Object.entries(contextGaps)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([feature, count]) => ({ feature, count }));
        // 5. Trust signals per merchant
        const trustSignals = {};
        Object.entries(merchantPatterns).forEach(([merchantId, m]) => {
            trustSignals[merchantId] = {
                merchantId,
                autoAcceptRate: m.approvalRate + m.modificationRate,
                overrideRate: 1 - (m.approvalRate + m.modificationRate),
                trustLevel: m.approvalRate > 0.7 ? 'high' : m.approvalRate > 0.4 ? 'medium' : 'low'
            };
        });
        res.json({
            period: 'last_7_days',
            generatedAt: new Date().toISOString(),
            dataAvailable: true,
            summary: {
                totalDecisions: weekFeedback.length,
                totalModifications: deltaAnalysis.length,
                avgDeltaPercent: Math.round(avgDelta * 100) / 100,
                avgImpactScore: Math.round(avgImpact * 1000) / 1000,
                totalMerchants: Object.keys(merchantPatterns).length
            },
            insights: {
                topReasons,
                topMerchantPatterns,
                topContextGaps,
                trustSignals: Object.values(trustSignals).slice(0, 5),
                clusters: detectClusters(deltaAnalysis)
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Simple cluster detection
function detectClusters(data) {
    // Basic cluster detection based on delta ranges
    const clusters = {
        aggressive: data.filter(d => d.deltaPercent > 15).length,
        moderate: data.filter(d => d.deltaPercent >= -15 && d.deltaPercent <= 15).length,
        conservative: data.filter(d => d.deltaPercent < -15).length
    };
    return clusters;
}
// Merchant insights
app.get('/insights/merchant/:merchantId', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const feedback = await Feedback.find({
            merchantId,
            feedbackReceivedAt: { $gte: oneMonthAgo }
        }).sort({ feedbackReceivedAt: -1 }).lean();
        if (feedback.length === 0) {
            return res.json({ found: false, merchantId });
        }
        // Calculate patterns
        const deltas = feedback
            .filter(f => f.deltaPercent !== undefined)
            .map(f => f.deltaPercent);
        const avgDelta = deltas.length > 0
            ? deltas.reduce((a, b) => a + b, 0) / deltas.length
            : 0;
        // Trust signal
        const approvals = feedback.filter(f => f.outcome === 'approved').length;
        const approvalsRate = approvals / feedback.length;
        // Repeat patterns
        const recentDeltas = deltas.slice(0, 7);
        const avgDeltaWeek = recentDeltas.length > 0
            ? recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length
            : 0;
        const deltaVariance = deltas.length > 1
            ? Math.sqrt(deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length)
            : 0;
        res.json({
            merchantId,
            period: 'last_30_days',
            found: true,
            profile: {
                decisions: feedback.length,
                avgDeltaPercent: Math.round(avgDelta * 100) / 100,
                trustLevel: approvalsRate > 0.7 ? 'high' : approvalsRate > 0.4 ? 'medium' : 'low',
                patternStability: deltaVariance < 5 ? 'stable' : deltaVariance < 15 ? 'moderate' : 'variable'
            },
            repeatPattern: {
                avgDelta7d: Math.round(avgDeltaWeek * 100) / 100,
                deltaVariance: Math.round(deltaVariance * 100) / 100,
                isPattern: recentDeltas.length >= 3 && deltaVariance < 10
            },
            decisions: feedback.slice(0, 20).map(f => ({
                itemId: f.itemId,
                outcome: f.outcome,
                deltaPercent: f.deltaPercent,
                reasonCategory: f.reasonCategory,
                timestamp: f.feedbackReceivedAt
            }))
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Dashboard info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'rez-feedback-service',
        version: '1.0.0',
        mode: 'learning',
        description: 'Feedback + Insight Synthesis Service',
        endpoints: {
            health: '/health',
            feedback: 'POST /feedback',
            stats: '/stats',
            insights: {
                weekly: 'GET /insights/weekly',
                merchant: 'GET /insights/merchant/:merchantId'
            },
            patterns: '/modification-stats',
            loop: '/loop-test'
        }
    });
});
start();
//# sourceMappingURL=index-learning.js.map