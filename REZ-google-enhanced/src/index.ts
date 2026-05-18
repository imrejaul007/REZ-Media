/**
 * REZ Google Enhanced Conversions Service
 *
 * Port: 4085
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4085', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.debug('Incoming request', { path: req.path });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rez-google-enhanced' });
});

app.post('/api/conversions', async (req, res) => {
  const { eventName, orderId, value, currency, gclid, userIdentity } = req.body;

  if (!userIdentity?.email && !userIdentity?.phone) {
    return res.status(400).json({ success: false, error: 'Email or phone required' });
  }

  // Log the conversion event
  logger.info('[Google Enhanced] Conversion received', { eventName, orderId });

  res.json({ success: true, message: 'Conversion logged' });
});

app.post('/api/conversions/batch', async (req, res) => {
  const { conversions } = req.body;

  if (!Array.isArray(conversions) || conversions.length === 0) {
    return res.status(400).json({ success: false, error: 'conversions array required' });
  }

  logger.info('[Google Enhanced] Batch received', { count: conversions.length });
  res.json({ success: true, count: conversions.length });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal error' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ Google Enhanced Service started on port ${PORT}`);
});

export default app;
