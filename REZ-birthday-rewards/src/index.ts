/**
 * REZ Birthday Rewards - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4073', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-birthday-rewards' });
});

// Check eligibility
app.get('/api/birthday/eligibility/:userId', async (req, res) => {
  res.json({
    success: true,
    data: {
      eligible: true,
      daysUntilBirthday: Math.floor(Math.random() * 365),
      reward: { coins: 100, discount: 10 },
    },
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Birthday Rewards running on port ${PORT}`);
});

export default app;
