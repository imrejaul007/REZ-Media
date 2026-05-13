import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Merchant, { MerchantStatus } from '../models/Merchant';
import KYC, { KYCStatus, KYCDocumentType } from '../models/KYC';
import { authenticate, internalServiceAuth } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import { NotificationService } from '../services/notificationService';
import { EmailService } from '../services/emailService';

const router = Router();

/**
 * GET /api/approval/merchants
 * Get merchants pending approval (admin endpoint)
 */
router.get(
  '/merchants',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const query: Record<string, unknown> = {};

      // Filter by status if provided
      if (status) {
        query.status = status;
      } else {
        // Default to showing merchants awaiting review
        query.status = {
          $in: [
            MerchantStatus.KYC_SUBMITTED,
            MerchantStatus.KYC_VERIFIED,
            MerchantStatus.BUSINESS_SUBMITTED,
            MerchantStatus.UNDER_REVIEW
          ]
        };
      }

      // Search by email or business name
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await Merchant.countDocuments(query);
      const merchants = await Merchant.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password -emailVerificationToken -emailVerificationExpires');

      // Get KYC data for each merchant
      const merchantIds = merchants.map((m) => m._id);
      const kycRecords = await KYC.find({ merchantId: { $in: merchantIds } });

      const kycMap = new Map(kycRecords.map((kyc) => [kyc.merchantId.toString(), kyc]));

      const merchantsWithKYC = merchants.map((merchant) => {
        const kyc = kycMap.get(merchant._id.toString());
        return {
          ...merchant.toJSON(),
          kyc: kyc ? {
            status: kyc.status,
            documentsCount: kyc.documents.length,
            verifiedDocumentsCount: kyc.documents.filter((d) => d.verified).length,
            panNumber: kyc.panNumber
          } : null
        };
      });

      res.json({
        success: true,
        data: {
          merchants: merchantsWithKYC,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get merchants error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch merchants.'
      });
    }
  }
);

/**
 * GET /api/approval/merchants/:id
 * Get detailed merchant information (admin endpoint)
 */
router.get(
  '/merchants/:id',
  authenticate,
  validate(schemas.mongoId),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const merchant = await Merchant.findById(req.params.id)
        .select('-password -emailVerificationToken -emailVerificationExpires');

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      const kyc = await KYC.findOne({ merchantId: merchant._id });

      res.json({
        success: true,
        data: {
          merchant,
          kyc
        }
      });
    } catch (error) {
      console.error('Get merchant details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch merchant details.'
      });
    }
  }
);

/**
 * POST /api/approval/kyc/review
 * Review KYC documents
 */
router.post(
  '/kyc/review',
  authenticate,
  validate(schemas.reviewKYC),
  async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { merchantId, action, rejectionReason } = req.body;
      const adminId = req.merchant?._id;

      const merchant = await Merchant.findById(merchantId).session(session);

      if (!merchant) {
        await session.abortTransaction();
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      const kyc = await KYC.findOne({ merchantId }).session(session);

      if (!kyc) {
        await session.abortTransaction();
        res.status(404).json({
          success: false,
          error: 'KYC record not found.'
        });
        return;
      }

      if (action === 'approve') {
        // Approve KYC
        kyc.status = KYCStatus.VERIFIED;
        kyc.verifiedBy = adminId;
        kyc.verifiedAt = new Date();

        // Mark all documents as verified
        kyc.documents.forEach((doc) => {
          doc.verified = true;
          doc.verifiedAt = new Date();
          doc.verifiedBy = adminId;
        });

        // Update merchant status
        merchant.status = MerchantStatus.KYC_VERIFIED;

        await kyc.save({ session });
        await merchant.save({ session });

        await session.commitTransaction();

        res.json({
          success: true,
          message: 'KYC verified successfully.',
          data: {
            merchantStatus: merchant.status,
            kycStatus: kyc.status
          }
        });
      } else if (action === 'reject') {
        if (!rejectionReason) {
          await session.abortTransaction();
          res.status(400).json({
            success: false,
            error: 'Rejection reason is required.'
          });
          return;
        }

        // Request revision
        kyc.status = KYCStatus.REVISION_REQUESTED;
        kyc.rejectionReason = rejectionReason;

        merchant.status = MerchantStatus.REVISION_REQUESTED;

        await kyc.save({ session });
        await merchant.save({ session });

        await session.commitTransaction();

        // Send email notification
        await EmailService.sendKYCRevisionRequestEmail(merchant, rejectionReason);

        res.json({
          success: true,
          message: 'KYC revision requested.',
          data: {
            merchantStatus: merchant.status,
            kycStatus: kyc.status,
            rejectionReason
          }
        });
      }
    } catch (error) {
      await session.abortTransaction();
      console.error('KYC review error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review KYC.'
      });
    } finally {
      session.endSession();
    }
  }
);

/**
 * POST /api/approval/kyc/document/:merchantId/:documentType/review
 * Review a specific KYC document
 */
router.post(
  '/kyc/document/:merchantId/:documentType/review',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { merchantId, documentType } = req.params;
      const { action, rejectionReason } = req.body;
      const adminId = req.merchant?._id;

      if (!['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be "approve" or "reject".'
        });
        return;
      }

      const kyc = await KYC.findOne({ merchantId });

      if (!kyc) {
        res.status(404).json({
          success: false,
          error: 'KYC record not found.'
        });
        return;
      }

      const document = kyc.documents.find((d) => d.type === documentType);

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found.'
        });
        return;
      }

      if (action === 'approve') {
        document.verified = true;
        document.verifiedAt = new Date();
        document.verifiedBy = adminId;
      } else {
        document.verified = false;
        document.rejectionReason = rejectionReason || 'Document rejected by admin';

        // Check if this affects overall KYC status
        const allVerified = kyc.documents.every((d) => d.verified);
        if (allVerified) {
          kyc.status = KYCStatus.VERIFIED;
        } else {
          kyc.status = KYCStatus.SUBMITTED;
        }
      }

      await kyc.save();

      res.json({
        success: true,
        message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        data: {
          document: {
            type: document.type,
            verified: document.verified,
            verifiedAt: document.verifiedAt,
            rejectionReason: document.rejectionReason
          },
          allDocumentsVerified: kyc.documents.every((d) => d.verified)
        }
      });
    } catch (error) {
      console.error('Document review error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review document.'
      });
    }
  }
);

/**
 * POST /api/approval/business/review
 * Review business details
 */
router.post(
  '/business/review',
  authenticate,
  validate(schemas.reviewBusiness),
  async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { merchantId, action, rejectionReason } = req.body;
      const adminId = req.merchant?._id;

      const merchant = await Merchant.findById(merchantId).session(session);

      if (!merchant) {
        await session.abortTransaction();
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Validate merchant has business details
      if (!merchant.businessName || !merchant.businessAddress || !merchant.bankDetails) {
        await session.abortTransaction();
        res.status(400).json({
          success: false,
          error: 'Business details incomplete. Cannot approve.'
        });
        return;
      }

      if (action === 'approve') {
        merchant.status = MerchantStatus.UNDER_REVIEW;
        await merchant.save({ session });

        await session.commitTransaction();

        res.json({
          success: true,
          message: 'Business details approved. Ready for final review.',
          data: {
            merchantStatus: merchant.status
          }
        });
      } else if (action === 'reject') {
        if (!rejectionReason) {
          await session.abortTransaction();
          res.status(400).json({
            success: false,
            error: 'Rejection reason is required.'
          });
          return;
        }

        merchant.status = MerchantStatus.REVISION_REQUESTED;
        merchant.rejectionReason = rejectionReason;

        await merchant.save({ session });

        await session.commitTransaction();

        // Send email notification
        await EmailService.sendRejectionEmail(merchant, rejectionReason);

        res.json({
          success: true,
          message: 'Business details rejected.',
          data: {
            merchantStatus: merchant.status,
            rejectionReason
          }
        });
      }
    } catch (error) {
      await session.abortTransaction();
      console.error('Business review error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review business details.'
      });
    } finally {
      session.endSession();
    }
  }
);

/**
 * POST /api/approval/merchant/approve
 * Final approval of merchant
 */
router.post(
  '/merchant/approve',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { merchantId } = req.body;
      const adminId = req.merchant?._id;

      const merchant = await Merchant.findById(merchantId).session(session);

      if (!merchant) {
        await session.abortTransaction();
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Validate merchant is ready for approval
      const validStatuses = [MerchantStatus.UNDER_REVIEW, MerchantStatus.KYC_VERIFIED, MerchantStatus.BUSINESS_SUBMITTED];
      if (!validStatuses.includes(merchant.status)) {
        await session.abortTransaction();
        res.status(400).json({
          success: false,
          error: `Cannot approve merchant with status: ${merchant.status}. Merchant must be under review or have completed verification.`
        });
        return;
      }

      // Verify KYC is complete
      const kyc = await KYC.findOne({ merchantId }).session(session);
      if (!kyc || kyc.status !== KYCStatus.VERIFIED) {
        await session.abortTransaction();
        res.status(400).json({
          success: false,
          error: 'KYC must be verified before final approval.'
        });
        return;
      }

      // Final approval
      merchant.status = MerchantStatus.APPROVED;
      merchant.reviewedBy = adminId;
      merchant.reviewedAt = new Date();
      merchant.rejectionReason = undefined;

      await merchant.save({ session });

      await session.commitTransaction();

      // Send approval email
      await EmailService.sendApprovalEmail(merchant);

      // Notify other services
      await NotificationService.notifyMerchantApproved(merchant);

      res.json({
        success: true,
        message: 'Merchant approved successfully!',
        data: {
          merchantId: merchant._id,
          email: merchant.email,
          businessName: merchant.businessName,
          status: merchant.status,
          reviewedAt: merchant.reviewedAt
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Merchant approval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve merchant.'
      });
    } finally {
      session.endSession();
    }
  }
);

/**
 * POST /api/approval/merchant/reject
 * Reject merchant application
 */
router.post(
  '/merchant/reject',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { merchantId, rejectionReason } = req.body;
      const adminId = req.merchant?._id;

      if (!rejectionReason) {
        res.status(400).json({
          success: false,
          error: 'Rejection reason is required.'
        });
        return;
      }

      const merchant = await Merchant.findById(merchantId).session(session);

      if (!merchant) {
        await session.abortTransaction();
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      merchant.status = MerchantStatus.REJECTED;
      merchant.rejectionReason = rejectionReason;
      merchant.reviewedBy = adminId;
      merchant.reviewedAt = new Date();

      await merchant.save({ session });

      await session.commitTransaction();

      // Send rejection email
      await EmailService.sendRejectionEmail(merchant, rejectionReason);

      // Notify admins
      await NotificationService.notifyMerchantRejected(merchant, rejectionReason);

      res.json({
        success: true,
        message: 'Merchant application rejected.',
        data: {
          merchantId: merchant._id,
          status: merchant.status,
          rejectionReason,
          reviewedAt: merchant.reviewedAt
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Merchant rejection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject merchant.'
      });
    } finally {
      session.endSession();
    }
  }
);

/**
 * GET /api/approval/stats
 * Get approval statistics (admin endpoint)
 */
router.get(
  '/stats',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await Merchant.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statsMap: Record<string, number> = {};
      stats.forEach((s) => {
        statsMap[s._id] = s.count;
      });

      const totalMerchants = Object.values(statsMap).reduce((a, b) => a + b, 0);

      res.json({
        success: true,
        data: {
          total: totalMerchants,
          byStatus: statsMap,
          pendingReview: (statsMap[MerchantStatus.KYC_SUBMITTED] || 0) +
            (statsMap[MerchantStatus.BUSINESS_SUBMITTED] || 0) +
            (statsMap[MerchantStatus.UNDER_REVIEW] || 0),
          approved: statsMap[MerchantStatus.APPROVED] || 0,
          rejected: statsMap[MerchantStatus.REJECTED] || 0
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics.'
      });
    }
  }
);

export default router;
