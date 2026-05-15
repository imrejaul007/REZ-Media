/**
 * REZ Heatmaps - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4074', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-heatmaps' });
});

// Get heatmap data
app.get('/api/heatmaps/:websiteId', async (req, res) => {
  res.json({
    success: true,
    data: {
      clicks: [],
      scrolls: [],
      movements: [],
    },
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Heatmaps running on port ${PORT}`);
});

export default app;
