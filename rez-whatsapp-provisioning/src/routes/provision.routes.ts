import { Router, Request, Response } from 'express';
import { subaccountService } from '../services/subaccountService';
import MerchantWhatsApp from '../models/MerchantWhatsApp';
import { logger } from '../utils/logger';
import { asyncHandler, NotFoundError, ConflictError } from '../middleware/error';
import { validateBody } from '../middleware/validation';
import { merchantProvisionSchema } from '../middleware/validation';
import { validateInternalServiceToken } from '../middleware/auth';
import { MerchantStatus } from '../types';
import { provisioningLimits } from '../config/twilio.config';

const router = Router();

router.post(
  '/provision',
  validateInternalServiceToken,
  validateBody(merchantProvisionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      merchantId,
      businessName,
      businessEmail,
      businessPhone,
      industry,
      useCase,
      webhookUrl,
      metadata,
    } = req.body;

    logger.info('Provisioning WhatsApp for merchant', { merchantId });

    const existing = await MerchantWhatsApp.findByMerchantId(merchantId);
    if (existing) {
      throw new ConflictError(`Merchant ${merchantId} already has WhatsApp provisioned`);
    }

    const subaccountFriendlyName = `${businessName.replace(/[^a-zA-Z0-9]/g, '_')}_${merchantId}`;

    const subaccount = await subaccountService.createSubaccount(
      merchantId,
      subaccountFriendlyName,
      businessEmail
    );

    const merchantRecord = new MerchantWhatsApp({
      merchantId,
      businessName,
      businessEmail,
      businessPhone,
      industry,
      useCase,
      status: MerchantStatus.ACTIVE,
      subaccountSid: subaccount.sid,
      subaccountFriendlyName: subaccount.friendlyName,
      subaccountStatus: 'active',
      webhookUrl,
      twilioAccountSid: subaccount.sid,
      credentials: {
        apiKeySid: subaccount.apiKeySid,
        apiKeySecret: subaccount.apiKeySecret,
      },
      provisioning: {
        sandboxCompleted: false,
        phoneNumbersProvisioned: 0,
        templatesApproved: 0,
      },
      limits: {
        maxPhoneNumbers: provisioningLimits.maxPhoneNumbersPerMerchant,
        maxTemplates: provisioningLimits.maxTemplatesPerMerchant,
      },
      metadata: metadata || {},
    });

    await merchantRecord.save();

    logger.info('WhatsApp provisioning completed', {
      merchantId,
      subaccountSid: subaccount.sid,
    });

    res.status(201).json({
      success: true,
      message: 'WhatsApp provisioned successfully',
      data: {
        merchantId,
        subaccountSid: subaccount.sid,
        apiKeySid: subaccount.apiKeySid,
        apiKeySecret: subaccount.apiKeySecret,
        status: MerchantStatus.ACTIVE,
        limits: merchantRecord.limits,
      },
    });
  })
);

router.get(
  '/:merchantId',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    res.json({
      success: true,
      data: merchant.toPublicJSON(),
    });
  })
);

router.patch(
  '/:merchantId/suspend',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    await subaccountService.suspendSubaccount(merchant.subaccountSid);

    merchant.status = MerchantStatus.SUSPENDED;
    merchant.subaccountStatus = 'suspended';
    await merchant.save();

    logger.info('Merchant WhatsApp suspended', { merchantId });

    res.json({
      success: true,
      message: 'Merchant WhatsApp suspended',
      data: merchant.toPublicJSON(),
    });
  })
);

router.patch(
  '/:merchantId/activate',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    await subaccountService.activateSubaccount(merchant.subaccountSid);

    merchant.status = MerchantStatus.ACTIVE;
    merchant.subaccountStatus = 'active';
    await merchant.save();

    logger.info('Merchant WhatsApp activated', { merchantId });

    res.json({
      success: true,
      message: 'Merchant WhatsApp activated',
      data: merchant.toPublicJSON(),
    });
  })
);

router.delete(
  '/:merchantId',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    await subaccountService.closeSubaccount(merchant.subaccountSid);

    merchant.status = MerchantStatus.DELETED;
    merchant.subaccountStatus = 'closed';
    await merchant.save();

    logger.info('Merchant WhatsApp closed', { merchantId });

    res.json({
      success: true,
      message: 'Merchant WhatsApp closed',
    });
  })
);

router.get(
  '/:merchantId/usage',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const usage = await subaccountService.getSubaccountUsage(
      merchant.subaccountSid,
      start,
      end
    );

    res.json({
      success: true,
      data: {
        subaccountSid: merchant.subaccountSid,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        usage,
      },
    });
  })
);

router.post(
  '/:merchantId/regenerate-credentials',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant WhatsApp', merchantId);
    }

    const newCredentials = await subaccountService.regenerateApiKey(merchant.subaccountSid);

    merchant.credentials = {
      apiKeySid: newCredentials.apiKeySid,
      apiKeySecret: newCredentials.apiKeySecret,
    };
    await merchant.save();

    logger.info('API credentials regenerated', { merchantId });

    res.json({
      success: true,
      message: 'API credentials regenerated',
      data: {
        apiKeySid: newCredentials.apiKeySid,
        apiKeySecret: newCredentials.apiKeySecret,
      },
    });
  })
);

export default router;
