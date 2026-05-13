import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Merchant, { MerchantStatus } from '../models/Merchant';
import KYC, { KYCDocumentType, KYCStatus } from '../models/KYC';
import { authenticate, requireEmailVerified, requireStatus } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import { NotificationService } from '../services/notificationService';
import { EmailService } from '../services/emailService';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB default
  }
});

/**
 * GET /api/kyc/status
 * Get current KYC status for the authenticated merchant
 */
router.get(
  '/status',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const kyc = await KYC.findOne({ merchantId: req.merchant!._id });

      if (!kyc) {
        res.json({
          success: true,
          data: {
            status: KYCStatus.PENDING,
            documentsSubmitted: [],
            hasPendingDocuments: true
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          status: kyc.status,
          documents: kyc.documents.map((doc) => ({
            type: doc.type,
            uploadedAt: doc.uploadedAt,
            verified: doc.verified
          })),
          hasPendingDocuments: kyc.documents.length < 3 // Minimum required docs
        }
      });
    } catch (error) {
      console.error('Get KYC status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KYC status.'
      });
    }
  }
);

/**
 * GET /api/kyc
 * Get full KYC details for the authenticated merchant
 */
router.get(
  '/',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const kyc = await KYC.findOne({ merchantId: req.merchant!._id });

      if (!kyc) {
        res.status(404).json({
          success: false,
          error: 'KYC not found. Please submit KYC first.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          kyc
        }
      });
    } catch (error) {
      console.error('Get KYC error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KYC details.'
      });
    }
  }
);

/**
 * POST /api/kyc/submit
 * Submit initial KYC information
 */
router.post(
  '/submit',
  authenticate,
  requireEmailVerified,
  requireStatus(MerchantStatus.EMAIL_VERIFIED, MerchantStatus.KYC_VERIFIED, MerchantStatus.REVISION_REQUESTED),
  validate(schemas.submitKYC),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { panNumber, aadhaarNumber, permanentAddress } = req.body;
      const merchantId = req.merchant!._id;

      // Check if KYC exists
      let kyc = await KYC.findOne({ merchantId });

      if (!kyc) {
        // Create new KYC
        kyc = new KYC({
          merchantId,
          status: KYCStatus.SUBMITTED,
          panNumber,
          aadhaarNumber,
          permanentAddress
        });
      } else {
        // Update existing KYC
        if (panNumber) kyc.panNumber = panNumber;
        if (aadhaarNumber) kyc.aadhaarNumber = aadhaarNumber;
        if (permanentAddress) kyc.permanentAddress = permanentAddress;
        kyc.status = KYCStatus.SUBMITTED;
        kyc.rejectionReason = undefined;
      }

      await kyc.save();

      // Update merchant status
      const merchant = await Merchant.findById(merchantId);
      if (merchant) {
        merchant.status = MerchantStatus.KYC_SUBMITTED;
        await merchant.save();

        // Notify admins
        await NotificationService.notifyKYCDocumentsSubmitted(merchant);
      }

      res.json({
        success: true,
        message: 'KYC submitted successfully. Please upload the required documents.',
        data: {
          kyc
        }
      });
    } catch (error) {
      console.error('Submit KYC error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit KYC. Please try again.'
      });
    }
  }
);

/**
 * POST /api/kyc/documents
 * Upload KYC documents
 */
router.post(
  '/documents',
  authenticate,
  requireEmailVerified,
  requireStatus(MerchantStatus.EMAIL_VERIFIED, MerchantStatus.KYC_SUBMITTED, MerchantStatus.KYC_VERIFIED, MerchantStatus.REVISION_REQUESTED),
  upload.single('document'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No document file uploaded.'
        });
        return;
      }

      const { documentType } = req.body;

      // Validate document type
      if (!Object.values(KYCDocumentType).includes(documentType)) {
        res.status(400).json({
          success: false,
          error: `Invalid document type. Valid types: ${Object.values(KYCDocumentType).join(', ')}`
        });
        return;
      }

      const merchantId = req.merchant!._id;

      // Get or create KYC record
      let kyc = await KYC.findOne({ merchantId });

      if (!kyc) {
        kyc = new KYC({
          merchantId,
          status: KYCStatus.SUBMITTED
        });
      }

      // Check if document of this type already exists
      const existingDocIndex = kyc.documents.findIndex(
        (doc) => doc.type === documentType
      );

      const newDocument = {
        type: documentType as KYCDocumentType,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        uploadedAt: new Date(),
        verified: false
      };

      if (existingDocIndex !== -1) {
        // Replace existing document
        kyc.documents[existingDocIndex] = newDocument;
      } else {
        // Add new document
        kyc.documents.push(newDocument);
      }

      // Update status
      if (kyc.status === KYCStatus.PENDING || kyc.status === KYCStatus.REJECTED) {
        kyc.status = KYCStatus.SUBMITTED;
      }

      await kyc.save();

      // Update merchant status
      const merchant = await Merchant.findById(merchantId);
      if (merchant && merchant.status === MerchantStatus.EMAIL_VERIFIED) {
        merchant.status = MerchantStatus.KYC_SUBMITTED;
        await merchant.save();
      }

      res.json({
        success: true,
        message: 'Document uploaded successfully.',
        data: {
          document: newDocument,
          totalDocuments: kyc.documents.length,
          requiredDocuments: [
            KYCDocumentType.PAN_CARD,
            KYCDocumentType.ADDRESS_PROOF,
            KYCDocumentType.BANK_ACCOUNT_PROOF
          ],
          submittedDocuments: kyc.documents.map((d) => d.type)
        }
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload document. Please try again.'
      });
    }
  }
);

/**
 * POST /api/kyc/documents/upload-batch
 * Upload multiple KYC documents at once
 */
router.post(
  '/documents/upload-batch',
  authenticate,
  requireEmailVerified,
  requireStatus(MerchantStatus.EMAIL_VERIFIED, MerchantStatus.KYC_SUBMITTED, MerchantStatus.KYC_VERIFIED, MerchantStatus.REVISION_REQUESTED),
  upload.array('documents', 5),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      const { documentTypes } = req.body;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No documents uploaded.'
        });
        return;
      }

      const merchantId = req.merchant!._id;
      let kyc = await KYC.findOne({ merchantId });

      if (!kyc) {
        kyc = new KYC({
          merchantId,
          status: KYCStatus.SUBMITTED
        });
      }

      const documentTypeArray = typeof documentTypes === 'string'
        ? JSON.parse(documentTypes)
        : documentTypes;

      const uploadedDocuments = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docType = documentTypeArray?.[i] || documentTypeArray?.[file.fieldname];

        if (!docType || !Object.values(KYCDocumentType).includes(docType)) {
          continue;
        }

        const newDocument = {
          type: docType as KYCDocumentType,
          fileUrl: `/uploads/${file.filename}`,
          fileName: file.originalname,
          uploadedAt: new Date(),
          verified: false
        };

        // Replace existing or add new
        const existingIndex = kyc.documents.findIndex((d) => d.type === docType);
        if (existingIndex !== -1) {
          kyc.documents[existingIndex] = newDocument;
        } else {
          kyc.documents.push(newDocument);
        }

        uploadedDocuments.push(newDocument);
      }

      kyc.status = KYCStatus.SUBMITTED;
      await kyc.save();

      // Update merchant status
      const merchant = await Merchant.findById(merchantId);
      if (merchant && merchant.status === MerchantStatus.EMAIL_VERIFIED) {
        merchant.status = MerchantStatus.KYC_SUBMITTED;
        await merchant.save();
      }

      res.json({
        success: true,
        message: `${uploadedDocuments.length} document(s) uploaded successfully.`,
        data: {
          uploadedDocuments,
          totalDocuments: kyc.documents.length
        }
      });
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload documents. Please try again.'
      });
    }
  }
);

/**
 * DELETE /api/kyc/documents/:type
 * Delete a KYC document
 */
router.delete(
  '/documents/:type',
  authenticate,
  requireEmailVerified,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.params;

      if (!Object.values(KYCDocumentType).includes(type as KYCDocumentType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid document type.'
        });
        return;
      }

      const merchantId = req.merchant!._id;
      const kyc = await KYC.findOne({ merchantId });

      if (!kyc) {
        res.status(404).json({
          success: false,
          error: 'KYC not found.'
        });
        return;
      }

      const docIndex = kyc.documents.findIndex((doc) => doc.type === type);

      if (docIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Document not found.'
        });
        return;
      }

      // Check if document is verified (can't delete verified docs)
      if (kyc.documents[docIndex].verified) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete verified documents. Please contact support.'
        });
        return;
      }

      kyc.documents.splice(docIndex, 1);
      await kyc.save();

      res.json({
        success: true,
        message: 'Document deleted successfully.',
        data: {
          remainingDocuments: kyc.documents.length
        }
      });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete document.'
      });
    }
  }
);

/**
 * GET /api/kyc/required
 * Get list of required KYC documents
 */
router.get(
  '/required',
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    const requiredDocuments = [
      {
        type: KYCDocumentType.PAN_CARD,
        name: 'PAN Card',
        description: 'Upload a clear copy of your PAN card (front and back)',
        required: true,
        formats: ['PDF', 'JPEG', 'PNG']
      },
      {
        type: KYCDocumentType.ADDRESS_PROOF,
        name: 'Address Proof',
        description: 'Aadhar Card, Voter ID, or Passport',
        required: true,
        formats: ['PDF', 'JPEG', 'PNG']
      },
      {
        type: KYCDocumentType.BANK_ACCOUNT_PROOF,
        name: 'Bank Account Proof',
        description: 'Cancelled cheque or bank statement with account details',
        required: true,
        formats: ['PDF', 'JPEG', 'PNG']
      },
      {
        type: KYCDocumentType.GST_CERTIFICATE,
        name: 'GST Certificate',
        description: 'If registered for GST',
        required: false,
        formats: ['PDF', 'JPEG', 'PNG']
      },
      {
        type: KYCDocumentType.BUSINESS_ADDRESS_PROOF,
        name: 'Business Address Proof',
        description: 'Electricity bill, rent agreement, or utility bill',
        required: false,
        formats: ['PDF', 'JPEG', 'PNG']
      }
    ];

    res.json({
      success: true,
      data: {
        requiredDocuments
      }
    });
  }
);

export default router;
