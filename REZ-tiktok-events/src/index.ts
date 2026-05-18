/**
 * REZ TikTok Events Service
 *
 * Port: 4086
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4086', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.debug('Incoming request', { path: req.path });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rez-tiktok-events' });
});

app.post('/api/events', async (req, res) => {
  const { eventName, orderId, value, email, phone } = req.body;

  logger.info('[TikTok] Event received', { eventName, orderId });
  res.json({ success: true, message: 'Event logged' });
});

app.post('/api/events/batch', async (req, res) => {
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ success: false, error: 'events array required' });
  }

  logger.info('[TikTok] Batch received', { count: events.length });
  res.json({ success: true, count: events.length });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal error' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ TikTok Events Service started on port ${PORT}`);
});

export default app;
