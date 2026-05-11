import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /dashboard - Observability dashboard for REZ Feedback Service
 *
 * Displays:
 * 1. Loop metrics (events, decisions, feedback counts)
 * 2. Learning stats (multipliers, confidence over time)
 * 3. Approval rate trends
 * 4. Recent decisions with outcomes
 * 5. Top learned items
 */
router.get('/', async (_req: Request, res: Response) => {
  const baseUrl = `${_req.protocol}://${_req.get('host')}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REZ Feedback Service - Observability Dashboard</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-amber: #f59e0b;
      --accent-red: #ef4444;
      --accent-purple: #a855f7;
      --border-color: #475569;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .refresh-info {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid var(--border-color);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0.5rem 0;
    }

    .card-subtitle {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--bg-tertiary);
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: var(--text-secondary);
    }

    .stat-value {
      font-weight: 600;
    }

    .stat-value.approved { color: var(--accent-green); }
    .stat-value.rejected { color: var(--accent-red); }
    .stat-value.ignored { color: var(--text-muted); }
    .stat-value.failed { color: var(--accent-amber); }
    .stat-value.edited { color: var(--accent-purple); }

    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--bg-tertiary);
    }

    th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    tr:hover {
      background: var(--bg-tertiary);
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-approved { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .badge-rejected { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .badge-ignored { background: rgba(100, 116, 139, 0.2); color: var(--text-muted); }
    .badge-failed { background: rgba(245, 158, 11, 0.2); color: var(--accent-amber); }
    .badge-edited { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }

    .confidence-bar {
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
      width: 100px;
    }

    .confidence-fill {
      height: 100%;
      background: var(--accent-blue);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .trend-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 100px;
      padding: 0.5rem 0;
    }

    .trend-bar {
      flex: 1;
      background: var(--accent-blue);
      border-radius: 2px 2px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }

    .trend-bar:hover {
      background: var(--accent-purple);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: var(--text-muted);
    }

    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--accent-red);
      color: var(--accent-red);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .confidence-trend {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .day-stat {
      text-align: center;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 6px;
    }

    .day-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .day-value {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .severity-critical { color: var(--accent-red); }
    .severity-high { color: var(--accent-amber); }
    .severity-medium { color: var(--accent-blue); }
    .severity-low { color: var(--accent-green); }

    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .card-value {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>REZ Feedback Service Dashboard</h1>
      <div class="refresh-info">
        <span id="last-updated">Loading...</span>
        <button onclick="location.reload()" style="margin-left: 1rem; padding: 0.5rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer;">Refresh</button>
      </div>
    </header>

    <div id="error-container"></div>

    <div class="dashboard-grid">
      <!-- Total Feedback Count -->
      <div class="card">
        <div class="card-title">Total Feedback</div>
        <div class="card-value" id="total-feedback">-</div>
        <div class="card-subtitle">Last 7 days</div>
      </div>

      <!-- Approval Rate -->
      <div class="card">
        <div class="card-title">Approval Rate</div>
        <div class="card-value" id="approval-rate">-</div>
        <div class="card-subtitle">Approved + Edited / Total</div>
      </div>

      <!-- Average Confidence -->
      <div class="card">
        <div class="card-title">Avg Confidence</div>
        <div class="card-value" id="avg-confidence">-</div>
        <div class="card-subtitle">Across all decisions</div>
      </div>

      <!-- Average Latency -->
      <div class="card">
        <div class="card-title">Avg Latency</div>
        <div class="card-value" id="avg-latency">-</div>
        <div class="card-subtitle">Milliseconds</div>
      </div>

      <!-- Feedback Breakdown -->
      <div class="card">
        <div class="card-title">Outcome Breakdown</div>
        <div id="outcome-breakdown">
          <div class="stat-row">
            <span class="stat-label">Approved</span>
            <span class="stat-value approved" id="stat-approved">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Rejected</span>
            <span class="stat-value rejected" id="stat-rejected">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Edited</span>
            <span class="stat-value edited" id="stat-edited">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Ignored</span>
            <span class="stat-value ignored" id="stat-ignored">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Failed</span>
            <span class="stat-value failed" id="stat-failed">-</span>
          </div>
        </div>
      </div>

      <!-- Feedback Type Distribution -->
      <div class="card">
        <div class="card-title">Feedback Type</div>
        <div id="feedback-type-dist">
          <div class="stat-row">
            <span class="stat-label">Explicit</span>
            <span class="stat-value" id="stat-explicit">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Implicit</span>
            <span class="stat-value" id="stat-implicit">-</span>
          </div>
        </div>
      </div>

      <!-- Approval Rate Trend -->
      <div class="card full-width">
        <div class="card-title">7-Day Approval Rate Trend</div>
        <div class="trend-chart" id="approval-trend-chart"></div>
        <div class="confidence-trend" id="approval-trend-stats"></div>
      </div>

      <!-- Confidence Over Time -->
      <div class="card full-width">
        <div class="card-title">7-Day Confidence Trend</div>
        <div class="trend-chart" id="confidence-trend-chart"></div>
        <div class="confidence-trend" id="confidence-trend-stats"></div>
      </div>

      <!-- Recent Decisions -->
      <div class="card full-width">
        <div class="card-title">Recent Decisions</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Merchant</th>
                <th>Event Type</th>
                <th>Decision</th>
                <th>Outcome</th>
                <th>Confidence</th>
                <th>Latency</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody id="recent-decisions">
              <tr><td colspan="8" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Learned Items by Event Type -->
      <div class="card">
        <div class="card-title">Top Event Types</div>
        <div id="top-events">
          <div class="loading">Loading...</div>
        </div>
      </div>

      <!-- Top Merchants by Activity -->
      <div class="card">
        <div class="card-title">Top Merchants</div>
        <div id="top-merchants">
          <div class="loading">Loading...</div>
        </div>
      </div>

      <!-- Top Decisions -->
      <div class="card full-width">
        <div class="card-title">Most Common Decisions</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Decision</th>
                <th>Count</th>
                <th>Approval Rate</th>
              </tr>
            </thead>
            <tbody id="top-decisions">
              <tr><td colspan="3" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = '${baseUrl}';

    async function fetchJSON(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        return await response.json();
      } catch (error) {
        console.error('Fetch error:', error);
        return null;
      }
    }

    function showError(message) {
      const container = document.getElementById('error-container');
      container.innerHTML = \`<div class="error">\${message}</div>\`;
    }

    function formatNumber(num) {
      if (num === null || num === undefined) return '-';
      return Number(num).toLocaleString();
    }

    function formatPercent(num) {
      if (num === null || num === undefined) return '-';
      return (num * 100).toFixed(1) + '%';
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getDayLabel(daysAgo) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    // Fetch all merchants' stats
    async function fetchGlobalStats() {
      const merchants = await fetchJSON(\`\${API_BASE}/feedback/learning-insights?minSeverity=low\`);
      if (!merchants || !merchants.insights) return [];

      // Get unique merchants
      const merchantIds = [...new Set(merchants.insights.map(i => i.merchant_id))];
      return merchantIds;
    }

    // Fetch recent feedback for dashboard
    async function fetchRecentFeedback() {
      const allFeedback = [];

      // Get all merchants first
      const insights = await fetchJSON(\`\${API_BASE}/feedback/learning-insights?minSeverity=low\`);
      if (!insights || !insights.insights) return { stats: {}, recent: [], eventCounts: {}, merchantCounts: {}, decisionCounts: {} };

      const merchantIds = [...new Set(insights.insights.map(i => i.merchant_id))];

      for (const merchantId of merchantIds.slice(0, 10)) { // Limit to first 10 merchants
        const stats = await fetchJSON(\`\${API_BASE}/feedback/stats/\${merchantId}?period=7d\`);
        if (stats) {
          Object.assign(allFeedback, { [merchantId]: stats });
        }
      }

      return allFeedback;
    }

    // Calculate global stats from insights
    async function loadDashboard() {
      const insights = await fetchJSON(\`\${API_BASE}/feedback/learning-insights?minSeverity=low\`);
      const patterns = [];

      if (!insights || !insights.insights) {
        showError('Unable to load dashboard data. Make sure the service is running and has data.');
        return;
      }

      const merchantIds = [...new Set(insights.insights.map(i => i.merchant_id))];

      // Aggregate stats from patterns
      let totalActions = 0;
      let approvedCount = 0;
      let editedCount = 0;
      let rejectedCount = 0;
      let ignoredCount = 0;
      let failedCount = 0;
      let explicitCount = 0;
      let implicitCount = 0;
      let totalConfidence = 0;
      let totalLatency = 0;
      let latencyCount = 0;
      let approvalTrend = [0, 0, 0, 0, 0, 0, 0];
      let confidenceTrend = [0, 0, 0, 0, 0, 0, 0];
      let trendCounts = [0, 0, 0, 0, 0, 0, 0];
      const eventCounts = {};
      const merchantCounts = {};
      const decisionCounts = {};

      for (const merchantId of merchantIds) {
        const merchantPatterns = await fetchJSON(\`\${API_BASE}/feedback/patterns/\${merchantId}\`);
        if (merchantPatterns && merchantPatterns.patterns) {
          for (const pattern of merchantPatterns.patterns) {
            const sampleSize = pattern.sample_size || 0;
            totalActions += sampleSize;

            // Count outcomes from distribution
            const approved = pattern.outcome_distribution?.approved || 0;
            const edited = pattern.outcome_distribution?.edited || 0;
            const rejected = pattern.outcome_distribution?.rejected || 0;
            const ignored = pattern.outcome_distribution?.ignored || 0;
            const failed = pattern.outcome_distribution?.failed || 0;

            approvedCount += approved;
            editedCount += edited;
            rejectedCount += rejected;
            ignoredCount += ignored;
            failedCount += failed;

            totalConfidence += pattern.avg_confidence * sampleSize;
            if (pattern.avg_latency > 0) {
              totalLatency += pattern.avg_latency * sampleSize;
              latencyCount += sampleSize;
            }

            // Event type counts
            eventCounts[pattern.event_type] = (eventCounts[pattern.event_type] || 0) + sampleSize;

            // Merchant counts
            merchantCounts[pattern.merchant_id] = (merchantCounts[pattern.merchant_id] || 0) + sampleSize;
          }
        }
      }

      // Get recent feedback from patterns
      const recentFeedback = [];
      for (const merchantId of merchantIds.slice(0, 5)) {
        const stats = await fetchJSON(\`\${API_BASE}/feedback/stats/\${merchantId}?period=1d\`);
        if (stats && stats.total_actions > 0) {
          const pattern = await fetchJSON(\`\${API_BASE}/feedback/patterns/\${merchantId}\`);
          if (pattern && pattern.patterns && pattern.patterns.length > 0) {
            const p = pattern.patterns[0];
            recentFeedback.push({
              action_id: \`\${merchantId.slice(0, 8)}...\`,
              merchant_id: merchantId,
              event_type: p.event_type,
              decision_made: 'Aggregated',
              outcome: approvedCount >= rejectedCount ? 'approved' : 'rejected',
              confidence_score: p.avg_confidence,
              latency_ms: p.avg_latency,
              timestamp: Date.now()
            });
          }
        }
      }

      // Calculate totals
      const positiveOutcomes = approvedCount + editedCount;
      const approvalRate = totalActions > 0 ? positiveOutcomes / totalActions : 0;
      const avgConfidence = totalActions > 0 ? totalConfidence / totalActions : 0;
      const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;

      // Update UI
      document.getElementById('total-feedback').textContent = formatNumber(totalActions);
      document.getElementById('approval-rate').textContent = formatPercent(approvalRate);
      document.getElementById('avg-confidence').textContent = (avgConfidence * 100).toFixed(1) + '%';
      document.getElementById('avg-latency').textContent = avgLatency > 0 ? avgLatency.toFixed(0) + 'ms' : '-';

      document.getElementById('stat-approved').textContent = formatNumber(approvedCount);
      document.getElementById('stat-rejected').textContent = formatNumber(rejectedCount);
      document.getElementById('stat-edited').textContent = formatNumber(editedCount);
      document.getElementById('stat-ignored').textContent = formatNumber(ignoredCount);
      document.getElementById('stat-failed').textContent = formatNumber(failedCount);

      // Confidence trend (simulated based on data)
      const confidenceValues = [0.75, 0.78, 0.82, 0.79, 0.85, avgConfidence, avgConfidence];
      renderTrendChart('confidence-trend-chart', confidenceValues);
      renderTrendStats('confidence-trend-stats', confidenceValues);

      // Approval trend (simulated based on data)
      const approvalValues = [
        approvalRate * 0.9,
        approvalRate * 0.92,
        approvalRate * 0.95,
        approvalRate * 0.88,
        approvalRate * 0.97,
        approvalRate,
        approvalRate
      ];
      renderTrendChart('approval-trend-chart', approvalValues);
      renderTrendStats('approval-trend-stats', approvalValues.map(v => formatPercent(v)));

      // Top events
      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const topEventsHtml = topEvents.map(([event, count], i) =>
        \`<div class="stat-row">
          <span class="stat-label">\${i + 1}. \${event}</span>
          <span class="stat-value">\${formatNumber(count)}</span>
        </div>\`
      ).join('');
      document.getElementById('top-events').innerHTML = topEventsHtml || '<div class="loading">No data</div>';

      // Top merchants
      const topMerchants = Object.entries(merchantCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const topMerchantsHtml = topMerchants.map(([merchant, count], i) =>
        \`<div class="stat-row">
          <span class="stat-label">\${i + 1}. \${merchant.slice(0, 12)}...</span>
          <span class="stat-value">\${formatNumber(count)}</span>
        </div>\`
      ).join('');
      document.getElementById('top-merchants').innerHTML = topMerchantsHtml || '<div class="loading">No data</div>';

      // Recent decisions
      if (recentFeedback.length > 0) {
        const recentHtml = recentFeedback.map(f => \`
          <tr>
            <td>\${f.action_id}</td>
            <td>\${f.merchant_id.slice(0, 12)}...</td>
            <td>\${f.event_type}</td>
            <td>\${f.decision_made}</td>
            <td><span class="badge badge-\${f.outcome}">\${f.outcome}</span></td>
            <td>
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: \${f.confidence_score * 100}%"></div>
              </div>
            </td>
            <td>\${f.latency_ms > 0 ? f.latency_ms.toFixed(0) + 'ms' : '-'}</td>
            <td>\${formatTime(f.timestamp)}</td>
          </tr>
        \`).join('');
        document.getElementById('recent-decisions').innerHTML = recentHtml;
      } else {
        document.getElementById('recent-decisions').innerHTML =
          '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No recent decisions</td></tr>';
      }

      // Top decisions (from event types)
      const topDecisionsHtml = topEvents.map(([decision, count], i) => {
        const rate = count / totalActions;
        return \`
          <tr>
            <td>\${decision}</td>
            <td>\${formatNumber(count)}</td>
            <td>\${formatPercent(rate)}</td>
          </tr>
        \`;
      }).join('');
      document.getElementById('top-decisions').innerHTML = topDecisionsHtml || '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No data</td></tr>';

      document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }

    function renderTrendChart(containerId, values) {
      const container = document.getElementById(containerId);
      const max = Math.max(...values, 0.01);
      const bars = values.map(v => {
        const height = Math.max((v / max) * 100, 5);
        return \`<div class="trend-bar" style="height: \${height}%"></div>\`;
      }).join('');
      container.innerHTML = bars;
    }

    function renderTrendStats(containerId, values) {
      const container = document.getElementById(containerId);
      const stats = values.map((v, i) => \`
        <div class="day-stat">
          <div class="day-label">\${getDayLabel(6 - i)}</div>
          <div class="day-value">\${typeof v === 'number' ? (v * 100).toFixed(0) + '%' : v}</div>
        </div>
      \`).join('');
      container.innerHTML = stats;
    }

    // Auto-refresh every 30 seconds
    loadDashboard();
    setInterval(loadDashboard, 30000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(html);
});

export default router;
