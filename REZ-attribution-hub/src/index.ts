/**
 * REZ Unified Attribution Hub
 *
 * Port: 4100
 *
 * Central orchestrator for all attribution services with
 * RABTUL, REZ Intelligence, and CorpPerks integration.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { unifiedAttributionHub } from './services/unifiedAttributionHub.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4100', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.debug('Incoming request', { path: req.path });
  next();
});

app.get('/health', async (_req, res) => {
  const services = await unifiedAttributionHub.healthCheck();
  const allHealthy = Object.values(services).every(Boolean);

  res.json({
    status: allHealthy ? 'ok' : 'degraded',
    service: 'rez-attribution-hub',
    services,
  });
});

app.post('/api/events', async (req, res) => {
  try {
    const result = await unifiedAttributionHub.processEvent({
      eventName: req.body.eventName,
      eventId: req.body.eventId || `evt_${Date.now()}`,
      timestamp: new Date(),
      email: req.body.email,
      phone: req.body.phone,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      deviceId: req.body.deviceId,
      sessionId: req.body.sessionId,
      fingerprint: req.body.fingerprint,
      ip: req.body.ip || req.ip,
      userAgent: req.body.userAgent || req.headers['user-agent'],
      url: req.body.url,
      merchantId: req.body.merchantId,
      storeId: req.body.storeId,
      value: req.body.value,
      currency: req.body.currency,
      contentIds: req.body.contentIds,
      contents: req.body.contents,
      orderId: req.body.orderId,
      cartId: req.body.cartId,
      searchString: req.body.searchString,
      utmSource: req.body.utmSource,
      utmMedium: req.body.utmMedium,
      utmCampaign: req.body.utmCampaign,
      utmTerm: req.body.utmTerm,
      utmContent: req.body.utmContent,
      gclid: req.body.gclid,
      fbc: req.body.fbc,
      fbp: req.body.fbp,
      ttp: req.body.ttp,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Event processing failed', { error });
    res.status(500).json({ success: false, error: 'Processing failed' });
  }
});

app.get('/api/reports/channels/:merchantId', async (req, res) => {
  const report = await unifiedAttributionHub.getChannelReport(req.params.merchantId);
  res.json({ success: true, data: report });
});

app.get('/api/reports/customer/:customerId', async (req, res) => {
  const model = req.query.model as string || 'linear';
  const report = await unifiedAttributionHub.getCustomerAttribution(req.params.customerId, model as any);
  res.json({ success: true, data: report });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal error' });
});

unifiedAttributionHub.initialize().catch(console.error);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ Attribution Hub started on port ${PORT}`);
});

export default app;
