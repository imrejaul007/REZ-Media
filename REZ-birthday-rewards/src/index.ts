/**
 * REZ Birthday Rewards Service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'REZ-birthday-rewards' });
});

// Routes
app.use('/api/birthday', require('./routes/birthday'));
app.use('/api/config', require('./routes/config'));
app.use('/api/analytics', require('./routes/analytics'));

const PORT = process.env.PORT || 4018;
app.listen(PORT, () => {
  console.log(`REZ Birthday Rewards running on port ${PORT}`);
});
