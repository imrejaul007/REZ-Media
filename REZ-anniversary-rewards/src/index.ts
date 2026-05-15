/**
 * REZ Anniversary Rewards - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

const app = express();
const PORT = parseInt(process.env.PORT || '4035', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anniversary';

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-anniversary-rewards' });
});

// Milestone routes
app.get('/api/anniversary/milestones/:merchantId', async (_req, res) => {
  res.json({
    success: true,
    data: [
      { years: 1, name: 'First Anniversary', reward: 100, bonus: 1.1 },
      { years: 2, name: 'Second Anniversary', reward: 200, bonus: 1.2 },
      { years: 3, name: 'Third Anniversary', reward: 300, bonus: 1.3 },
      { years: 5, name: 'Fifth Anniversary', reward: 500, bonus: 1.5 },
      { years: 10, name: 'Decade', reward: 1000, bonus: 2.0 },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Anniversary Rewards running on port ${PORT}`);
});

export default app;
