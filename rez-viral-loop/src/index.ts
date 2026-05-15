/**
 * REZ Viral Loop - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4076', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-viral-loop' });
});

// Get viral loops
app.get('/api/loops', async (_req, res) => {
  res.json({ success: true, data: [] });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Viral Loop running on port ${PORT}`);
});

export default app;
