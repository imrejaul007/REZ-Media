import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhookService';
import { twilioService } from '../services/twilioService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.post(
  '/whatsapp/inbound',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.WEBHOOK_BASE_URL}${req.originalUrl}`;

    const params = req.body;

    const isValid = await webhookService.validateAndProcessWebhook(
      signature,
      url,
      params
    );

    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.warn('Invalid webhook signature', {
        ip: req.ip,
        path: req.path,
      });
      res.status(403).send('Forbidden');
      return;
    }

    const payload = {
      accountSid: params.AccountSid || params.accountSid,
      from: params.From || params.from,
      to: params.To || params.to,
      body: params.Body || params.body,
      numMedia: params.NumMedia || params.numMedia || '0',
      mediaContentType0: params.MediaContentType0,
      mediaUrl0: params.MediaUrl0,
      messageSid: params.MessageSid || params.messageSid,
      messageTimestamp: params.MessageTimestamp || params.messageTimestamp,
      profileName: params.ProfileName,
    };

    const result = await webhookService.processInboundMessage(payload);

    if (result.response) {
      res.status(200).send(result.response);
    } else {
      res.status(200).send();
    }
  })
);

router.post(
  '/whatsapp/status',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.WEBHOOK_BASE_URL}${req.originalUrl}`;

    const params = req.body;

    const isValid = await webhookService.validateAndProcessWebhook(
      signature,
      url,
      params
    );

    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.warn('Invalid status webhook signature', {
        ip: req.ip,
        path: req.path,
      });
      res.status(403).send('Forbidden');
      return;
    }

    const payload = {
      accountSid: params.AccountSid,
      messageSid: params.MessageSid,
      messageStatus: params.MessageStatus,
      to: params.To,
      from: params.From,
      errorCode: params.ErrorCode,
      errorMessage: params.ErrorMessage,
      price: params.Price,
      priceUnit: params.PriceUnit,
    };

    await webhookService.processMessageStatusUpdate(payload);

    res.status(200).send();
  })
);

router.post(
  '/whatsapp/outbound',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.WEBHOOK_BASE_URL}${req.originalUrl}`;

    const isValid = await webhookService.validateAndProcessWebhook(
      signature,
      url,
      req.body
    );

    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.warn('Invalid outbound webhook signature', {
        ip: req.ip,
        path: req.path,
      });
      res.status(403).send('Forbidden');
      return;
    }

    await webhookService.processOutboundWebhook(req.body);

    res.status(200).send();
  })
);

router.post(
  '/whatsapp/template',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.WEBHOOK_BASE_URL}${req.originalUrl}`;

    const isValid = await webhookService.validateAndProcessWebhook(
      signature,
      url,
      req.body
    );

    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.warn('Invalid template webhook signature', {
        ip: req.ip,
        path: req.path,
      });
      res.status(403).send('Forbidden');
      return;
    }

    const payload = {
      accountSid: req.body.AccountSid,
      templateSid: req.body.TemplateSid,
      templateStatus: req.body.TemplateStatus,
      rejectionReason: req.body.RejectionReason,
    };

    await webhookService.processTemplateStatusUpdate(payload);

    res.status(200).send();
  })
);

router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const events = webhookService.getEventHistory(limit);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  })
);

router.get(
  '/events/:eventId',
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const event = webhookService.getEvent(eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: event,
    });
  })
);

export default router;
