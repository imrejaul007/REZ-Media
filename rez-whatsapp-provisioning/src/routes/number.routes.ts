import { Router, Request, Response } from 'express';
import { numberService } from '../services/numberService';
import PhoneNumber from '../models/PhoneNumber';
import MerchantWhatsApp from '../models/MerchantWhatsApp';
import { logger } from '../utils/logger';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/error';
import { validateBody, validateQuery } from '../middleware/validation';
import {
  phoneNumberProvisionSchema,
  phoneNumberSearchSchema,
  paginationSchema,
} from '../middleware/validation';
import { validateInternalServiceToken, extractMerchantId } from '../middleware/auth';
import { PhoneNumberStatus } from '../types';

const router = Router();

router.post(
  '/search',
  validateInternalServiceToken,
  validateBody(phoneNumberSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { countryCode, type, areaCode, contains, limit } = req.body;

    const availableNumbers = await numberService.searchAvailableNumbers(countryCode, {
      type,
      areaCode,
      contains,
      limit,
    });

    res.json({
      success: true,
      data: {
        countryCode,
        type: type || 'local',
        count: availableNumbers.length,
        numbers: availableNumbers,
      },
    });
  })
);

router.post(
  '/provision',
  validateInternalServiceToken,
  validateBody(phoneNumberProvisionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      merchantId,
      subaccountSid,
      countryCode,
      type,
      areaCode,
      phoneNumber,
      friendlyName,
      capabilities,
      metadata,
    } = req.body;

    logger.info('Provisioning phone number', { merchantId, countryCode });

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    if (merchant.subaccountSid !== subaccountSid) {
      throw new ForbiddenError('Subaccount does not belong to this merchant');
    }

    if (!merchant.canProvisionPhoneNumber()) {
      throw new ForbiddenError(
        `Phone number limit (${merchant.limits.maxPhoneNumbers}) reached`
      );
    }

    const result = await numberService.provisionPhoneNumber({
      merchantId,
      subaccountSid,
      countryCode,
      type,
      areaCode,
      phoneNumber,
      friendlyName,
      capabilities,
    });

    res.status(201).json({
      success: true,
      message: 'Phone number provisioned successfully',
      data: {
        twilioSid: result.twilioSid,
        phoneNumber: result.phoneNumber.phoneNumber,
        countryCode: result.phoneNumber.countryCode,
        type: result.phoneNumber.type,
        status: result.phoneNumber.status,
        capabilities: result.phoneNumber.capabilities,
      },
    });
  })
);

router.get(
  '/:merchantId',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const { status, page, limit } = req.query;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const result = await numberService.listMerchantPhoneNumbers(merchantId, {
      status: status as PhoneNumberStatus,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({
      success: true,
      data: {
        phoneNumbers: result.phoneNumbers,
        pagination: {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string, 10) : 20)),
        },
      },
    });
  })
);

router.get(
  '/:merchantId/:phoneNumberSid',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, phoneNumberSid } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const phoneNumber = await PhoneNumber.findOne({
      merchantId,
      twilioSid: phoneNumberSid,
    });

    if (!phoneNumber) {
      throw new NotFoundError('Phone number', phoneNumberSid);
    }

    const twilioDetails = await numberService.getPhoneNumber(phoneNumberSid);

    res.json({
      success: true,
      data: {
        ...phoneNumber.toObject(),
        twilioDetails: twilioDetails || phoneNumber.twilioDetails,
      },
    });
  })
);

router.patch(
  '/:merchantId/:phoneNumberSid',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, phoneNumberSid } = req.params;
    const { friendlyName, voiceUrl, smsUrl } = req.body;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const updated = await numberService.updatePhoneNumber(merchantId, phoneNumberSid, {
      friendlyName,
      voiceUrl,
      smsUrl,
    });

    res.json({
      success: true,
      message: 'Phone number updated',
      data: updated,
    });
  })
);

router.delete(
  '/:merchantId/:phoneNumberSid',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, phoneNumberSid } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    await numberService.releasePhoneNumber(merchantId, phoneNumberSid);

    logger.info('Phone number released', { merchantId, phoneNumberSid });

    res.json({
      success: true,
      message: 'Phone number released',
    });
  })
);

router.post(
  '/:merchantId/:phoneNumberSid/sandbox',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, phoneNumberSid } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    await numberService.addToSandbox(phoneNumberSid);

    logger.info('Phone number added to sandbox', { merchantId, phoneNumberSid });

    res.json({
      success: true,
      message: 'Phone number added to sandbox',
    });
  })
);

export default router;
