import { Router, Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhookService';
import { verifySignature } from '../middleware/auth';
import winston from 'winston';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// GET: Webhook verification endpoint
router.get('/instagram', async (req: Request, res: Response) => {
  try {
    const isValid = webhookService.verifyWebhook(req);

    if (isValid) {
      const challenge = req.query['hub.challenge'];
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: 'Verification failed' });
    }
  } catch (error: any) {
    logger.error('Webhook verification error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST: Webhook event receiver
router.post('/instagram', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify signature if provided
    const signature = req.headers['x-hub-signature'] as string;
    if (signature && !verifySignature(req, signature)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Respond immediately to acknowledge receipt
    res.status(200).json({ status: 'ok' });

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookService.handleWebhook(req.body);
      } catch (error: any) {
        logger.error('Webhook processing error', {
          error: error.message,
          stack: error.stack,
        });
      }
    });
  } catch (error: any) {
    logger.error('Webhook handler error', { error: error.message });
    next(error);
  }
});

// POST: Test webhook endpoint (for development)
router.post('/instagram/test', async (req: Request, res: Response) => {
  try {
    const { testType, payload } = req.body;

    logger.info('Test webhook received', { testType });

    switch (testType) {
      case 'dm':
        const { webhookService: ws } = await import('../services/webhookService');
        const dmPayload = {
          object: 'instagram',
          entry: [{
            id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
            time: Date.now(),
            messaging: [{
              sender: { id: payload?.senderId || 'test_sender' },
              recipient: { id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '' },
              timestamp: Date.now(),
              message: {
                mid: `test_${Date.now()}`,
                text: payload?.text || 'Test message',
              },
            }],
          }],
        };
        await ws.handleWebhook(dmPayload);
        break;

      case 'comment':
        const commentPayload = {
          object: 'instagram',
          entry: [{
            id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
            time: Date.now(),
            changes: [{
              field: 'comments',
              value: {
                item: 'comment',
                id: `test_comment_${Date.now()}`,
                media_id: payload?.mediaId || 'test_media',
                text: payload?.text || 'Test comment',
                from: {
                  id: payload?.senderId || 'test_user',
                  username: payload?.username || 'test_user',
                },
                timestamp: new Date().toISOString(),
              },
            }],
          }],
        };
        await ws.handleWebhook(commentPayload);
        break;

      default:
        await webhookService.handleWebhook(req.body);
    }

    res.status(200).json({ success: true, message: 'Test webhook processed' });
  } catch (error: any) {
    logger.error('Test webhook error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
