import { Router, Request, Response } from 'express';
import { templateService } from '../services/templateService';
import MerchantWhatsApp from '../models/MerchantWhatsApp';
import { logger } from '../utils/logger';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/error';
import { validateBody } from '../middleware/validation';
import { templateCreateSchema, paginationSchema } from '../middleware/validation';
import { validateInternalServiceToken } from '../middleware/auth';
import { TemplateStatus, TemplateCategory } from '../types';

const router = Router();

router.post(
  '/',
  validateInternalServiceToken,
  validateBody(templateCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      merchantId,
      subaccountSid,
      name,
      language,
      category,
      components,
      metadata,
    } = req.body;

    logger.info('Creating template', { merchantId, templateName: name });

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    if (merchant.subaccountSid !== subaccountSid) {
      throw new ForbiddenError('Subaccount does not belong to this merchant');
    }

    if (!merchant.canProvisionTemplate()) {
      throw new ForbiddenError(
        `Template limit (${merchant.limits.maxTemplates}) reached`
      );
    }

    const result = await templateService.createTemplate({
      merchantId,
      subaccountSid,
      name,
      language,
      category,
      components,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: {
        twilioSid: result.twilioSid,
        name: result.template.name,
        language: result.template.language,
        category: result.template.category,
        status: result.status,
        components: result.template.components,
      },
    });
  })
);

router.get(
  '/merchant/:merchantId',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const { status, category, page, limit } = req.query;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const result = await templateService.listTemplates(merchantId, {
      status: status as TemplateStatus,
      category: category as TemplateCategory,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({
      success: true,
      data: {
        templates: result.templates,
        pagination: {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          total: result.total,
          totalPages: Math.ceil(
            result.total / (limit ? parseInt(limit as string, 10) : 20)
          ),
        },
      },
    });
  })
);

router.get(
  '/merchant/:merchantId/approved',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const templates = await templateService.getApprovedTemplates(merchantId);

    res.json({
      success: true,
      data: {
        templates,
        count: templates.length,
      },
    });
  })
);

router.get(
  '/:twilioSid',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { twilioSid } = req.params;

    const template = await templateService.getTemplate(twilioSid);

    if (!template) {
      throw new NotFoundError('Template', twilioSid);
    }

    res.json({
      success: true,
      data: template,
    });
  })
);

router.patch(
  '/:merchantId/:templateName',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, templateName } = req.params;
    const { language, components } = req.body;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    const updated = await templateService.updateTemplate(merchantId, templateName, {
      language,
      components,
    });

    logger.info('Template updated', { merchantId, templateName });

    res.json({
      success: true,
      message: 'Template updated',
      data: updated,
    });
  })
);

router.delete(
  '/:merchantId/:twilioSid',
  validateInternalServiceToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, twilioSid } = req.params;

    const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);

    if (!merchant) {
      throw new NotFoundError('Merchant', merchantId);
    }

    await templateService.deleteTemplate(merchantId, twilioSid);

    logger.info('Template deleted', { merchantId, twilioSid });

    res.json({
      success: true,
      message: 'Template deleted',
    });
  })
);

export default router;
