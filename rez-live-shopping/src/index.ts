/**
 * REZ Live Shopping - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4075', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-live-shopping' });
});

// Get live events
app.get('/api/events', async (_req, res) => {
  res.json({ success: true, data: [] });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Live Shopping running on port ${PORT}`);
});

export default app;
