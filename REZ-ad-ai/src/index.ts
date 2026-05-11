/**
 * REZ Ad Copilot - Derives intent signals from behavior
 */

import express from 'express';
import compression from 'compression';

const app = express();
app.use(compression());
app.use(express.json());

const PORT = parseInt(process.env.PORT || '4021', 10);
// SECURITY FIX: Fail at startup if MONGODB_URI not set
const MONGODB = process.env.MONGODB_URI;
if (!MONGODB) {
  throw new Error('MONGODB_URI environment variable is required');
}

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

app.post('/intent/predict', (req, res) => {
  const { userId, context } = req.body;

  // Simple prediction logic
  const intent = {
    userId,
    predicted_intent: 'browsing',
    confidence: 0.75,
    recommendations: ['show_deals', 'similar_items'],
    updatedAt: new Date(),
  };

  res.json({ intent });
});

app.listen(PORT, () => console.log(`Ad Copilot on ${PORT}`));
