import { Router, Request, Response } from 'express';
import Merchant, { MerchantStatus } from '../models/Merchant';
import { authenticate, requireEmailVerified, requireStatus } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import { NotificationService } from '../services/notificationService';

const router = Router();

/**
 * GET /api/business
 * Get business details for the authenticated merchant
 */
router.get(
  '/',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const merchant = await Merchant.findById(req.merchant!._id);

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          businessName: merchant.businessName,
          businessType: merchant.businessType,
          gstin: merchant.gstin,
          businessAddress: merchant.businessAddress,
          bankDetails: merchant.bankDetails ? {
            accountHolderName: merchant.bankDetails.accountHolderName,
            bankName: merchant.bankDetails.bankName,
            branchName: merchant.bankDetails.branchName,
            // Mask account number for security
            accountNumberMasked: merchant.bankDetails.accountNumber.slice(-4).padStart(merchant.bankDetails.accountNumber.length, '*'),
            ifscCode: merchant.bankDetails.ifscCode
          } : null
        }
      });
    } catch (error) {
      console.error('Get business details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch business details.'
      });
    }
  }
);

/**
 * PUT /api/business
 * Update business details
 */
router.put(
  '/',
  authenticate,
  requireEmailVerified,
  requireStatus(
    MerchantStatus.EMAIL_VERIFIED,
    MerchantStatus.KYC_SUBMITTED,
    MerchantStatus.KYC_VERIFIED,
    MerchantStatus.BUSINESS_SUBMITTED,
    MerchantStatus.REVISION_REQUESTED
  ),
  validate(schemas.updateBusiness),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { businessName, businessType, gstin, businessAddress } = req.body;
      const merchantId = req.merchant!._id;

      const merchant = await Merchant.findById(merchantId);

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Update fields
      if (businessName !== undefined) merchant.businessName = businessName;
      if (businessType !== undefined) merchant.businessType = businessType;
      if (gstin !== undefined) merchant.gstin = gstin;
      if (businessAddress !== undefined) merchant.businessAddress = businessAddress;

      // Validate GSTIN format if provided
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
        res.status(400).json({
          success: false,
          error: 'Invalid GSTIN format.'
        });
        return;
      }

      await merchant.save();

      res.json({
        success: true,
        message: 'Business details updated successfully.',
        data: {
          businessName: merchant.businessName,
          businessType: merchant.businessType,
          gstin: merchant.gstin,
          businessAddress: merchant.businessAddress
        }
      });
    } catch (error) {
      console.error('Update business details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update business details.'
      });
    }
  }
);

/**
 * POST /api/business/submit
 * Submit business details for verification
 */
router.post(
  '/submit',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const merchantId = req.merchant!._id;

      const merchant = await Merchant.findById(merchantId);

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Validate required fields
      if (!merchant.businessName) {
        res.status(400).json({
          success: false,
          error: 'Business name is required.',
          field: 'businessName'
        });
        return;
      }

      if (!merchant.businessType) {
        res.status(400).json({
          success: false,
          error: 'Business type is required.',
          field: 'businessType'
        });
        return;
      }

      if (!merchant.gstin) {
        res.status(400).json({
          success: false,
          error: 'GSTIN is required.',
          field: 'gstin'
        });
        return;
      }

      if (!merchant.businessAddress) {
        res.status(400).json({
          success: false,
          error: 'Business address is required.',
          field: 'businessAddress'
        });
        return;
      }

      if (!merchant.bankDetails) {
        res.status(400).json({
          success: false,
          error: 'Bank details are required.',
          field: 'bankDetails'
        });
        return;
      }

      // Update merchant status
      merchant.status = MerchantStatus.BUSINESS_SUBMITTED;
      await merchant.save();

      // Notify admins
      await NotificationService.notifyBusinessDetailsSubmitted(merchant);

      res.json({
        success: true,
        message: 'Business details submitted successfully for verification.',
        data: {
          status: merchant.status
        }
      });
    } catch (error) {
      console.error('Submit business details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit business details.'
      });
    }
  }
);

/**
 * PUT /api/business/bank
 * Update bank details
 */
router.put(
  '/bank',
  authenticate,
  requireEmailVerified,
  requireStatus(
    MerchantStatus.EMAIL_VERIFIED,
    MerchantStatus.KYC_SUBMITTED,
    MerchantStatus.KYC_VERIFIED,
    MerchantStatus.BUSINESS_SUBMITTED,
    MerchantStatus.REVISION_REQUESTED
  ),
  validate(schemas.updateBankDetails),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountHolderName, accountNumber, ifscCode, bankName, branchName } = req.body;
      const merchantId = req.merchant!._id;

      const merchant = await Merchant.findById(merchantId);

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Validate IFSC code format
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        res.status(400).json({
          success: false,
          error: 'Invalid IFSC code format.'
        });
        return;
      }

      // Validate account number (9-18 digits)
      if (!/^\d{9,18}$/.test(accountNumber)) {
        res.status(400).json({
          success: false,
          error: 'Invalid account number. Must be 9-18 digits.'
        });
        return;
      }

      // Update bank details
      merchant.bankDetails = {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        branchName
      };

      await merchant.save();

      res.json({
        success: true,
        message: 'Bank details updated successfully.',
        data: {
          bankDetails: {
            accountHolderName: merchant.bankDetails.accountHolderName,
            bankName: merchant.bankDetails.bankName,
            branchName: merchant.bankDetails.branchName,
            ifscCode: merchant.bankDetails.ifscCode,
            accountNumberMasked: `****${merchant.bankDetails.accountNumber.slice(-4)}`
          }
        }
      });
    } catch (error) {
      console.error('Update bank details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update bank details.'
      });
    }
  }
);

/**
 * GET /api/business/verification-status
 * Get the verification status of all business components
 */
router.get(
  '/verification-status',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const merchant = await Merchant.findById(req.merchant!._id);

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      const verificationStatus = {
        email: {
          verified: merchant.emailVerified,
          status: merchant.emailVerified ? 'verified' : 'pending'
        },
        businessName: {
          verified: !!merchant.businessName,
          status: merchant.businessName ? 'provided' : 'missing'
        },
        businessType: {
          verified: !!merchant.businessType,
          status: merchant.businessType ? 'provided' : 'missing'
        },
        gstin: {
          verified: !!merchant.gstin,
          status: merchant.gstin ? 'provided' : 'missing'
        },
        businessAddress: {
          verified: !!merchant.businessAddress,
          status: merchant.businessAddress ? 'provided' : 'missing'
        },
        bankDetails: {
          verified: !!merchant.bankDetails,
          status: merchant.bankDetails ? 'provided' : 'missing'
        }
      };

      const allComplete = Object.values(verificationStatus).every((item) => item.verified);

      res.json({
        success: true,
        data: {
          verificationStatus,
          allComplete,
          currentStatus: merchant.status
        }
      });
    } catch (error) {
      console.error('Get verification status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch verification status.'
      });
    }
  }
);

export default router;
