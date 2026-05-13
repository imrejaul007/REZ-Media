import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Merchant, { MerchantStatus } from '../models/Merchant';
import { authenticate, generateToken } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import { EmailService } from '../services/emailService';
import { NotificationService } from '../services/notificationService';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new merchant
 */
router.post(
  '/register',
  validate(schemas.register),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, phone, fullName } = req.body;

      // Check if merchant already exists
      const existingMerchant = await Merchant.findOne({ email: email.toLowerCase() });
      if (existingMerchant) {
        res.status(400).json({
          success: false,
          error: 'An account with this email already exists.'
        });
        return;
      }

      // Check if phone is already registered
      const existingPhone = await Merchant.findOne({ phone });
      if (existingPhone) {
        res.status(400).json({
          success: false,
          error: 'An account with this phone number already exists.'
        });
        return;
      }

      // Hash password
      const salt = await bcryptjs.genSalt(12);
      const hashedPassword = await bcryptjs.hash(password, salt);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create merchant
      const merchant = new Merchant({
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        fullName,
        emailVerificationToken,
        emailVerificationExpires,
        status: MerchantStatus.PENDING
      });

      await merchant.save();

      // Send verification email
      try {
        await EmailService.sendVerificationEmail(merchant);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }

      // Notify admins
      try {
        await NotificationService.notifyNewMerchantRegistration(merchant);
      } catch (notificationError) {
        console.error('Failed to notify admins:', notificationError);
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          merchantId: merchant._id,
          email: merchant.email,
          status: merchant.status
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed. Please try again.'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login merchant
 */
router.post(
  '/login',
  validate(schemas.login),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Find merchant with password field
      const merchant = await Merchant.findOne({ email: email.toLowerCase() }).select('+password');

      if (!merchant) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
        return;
      }

      // Check password
      const isMatch = await merchant.comparePassword(password);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
        return;
      }

      // Check if account is suspended
      if (merchant.status === MerchantStatus.SUSPENDED) {
        res.status(403).json({
          success: false,
          error: 'Your account has been suspended. Please contact support.'
        });
        return;
      }

      // Generate token
      const token = generateToken(merchant);

      res.json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          merchant: merchant.toJSON()
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed. Please try again.'
      });
    }
  }
);

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post(
  '/verify-email',
  validate(schemas.verifyEmail),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      // Find merchant with this verification token
      const merchant = await Merchant.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!merchant) {
        res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token. Please request a new verification email.'
        });
        return;
      }

      // Update merchant
      merchant.emailVerified = true;
      merchant.emailVerificationToken = undefined;
      merchant.emailVerificationExpires = undefined;
      merchant.status = MerchantStatus.EMAIL_VERIFIED;

      await merchant.save();

      // Generate token for immediate login
      const authToken = generateToken(merchant);

      res.json({
        success: true,
        message: 'Email verified successfully.',
        data: {
          token: authToken,
          merchant: merchant.toJSON()
        }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Email verification failed. Please try again.'
      });
    }
  }
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  validate(schemas.resendVerification),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      const merchant = await Merchant.findOne({ email: email.toLowerCase() });

      if (!merchant) {
        // Don't reveal if email exists
        res.json({
          success: true,
          message: 'If an account exists with this email, a verification email has been sent.'
        });
        return;
      }

      if (merchant.emailVerified) {
        res.status(400).json({
          success: false,
          error: 'This email is already verified.'
        });
        return;
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      merchant.emailVerificationToken = emailVerificationToken;
      merchant.emailVerificationExpires = emailVerificationExpires;

      await merchant.save();

      // Send verification email
      await EmailService.sendVerificationEmail(merchant);

      res.json({
        success: true,
        message: 'If an account exists with this email, a verification email has been sent.'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email. Please try again.'
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current merchant profile
 */
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: {
          merchant: req.merchant
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile.'
      });
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      const merchant = await Merchant.findOne({ email: email.toLowerCase() });

      if (!merchant) {
        // Don't reveal if email exists
        res.json({
          success: true,
          message: 'If an account exists with this email, a password reset email has been sent.'
        });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      merchant.emailVerificationToken = resetToken;
      merchant.emailVerificationExpires = resetTokenExpires;

      await merchant.save();

      // Send password reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

      const { default: EmailService } = await import('../services/emailService');

      const html = `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset for your ReZ merchant account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `;

      await EmailService.sendEmail({
        to: merchant.email,
        subject: 'ReZ - Password Reset Request',
        html
      });

      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset email has been sent.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process request. Please try again.'
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters.'
        });
        return;
      }

      const merchant = await Merchant.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!merchant) {
        res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token.'
        });
        return;
      }

      // Hash new password
      const salt = await bcryptjs.genSalt(12);
      const hashedPassword = await bcryptjs.hash(newPassword, salt);

      merchant.password = hashedPassword;
      merchant.emailVerificationToken = undefined;
      merchant.emailVerificationExpires = undefined;

      await merchant.save();

      res.json({
        success: true,
        message: 'Password reset successful. Please login with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password. Please try again.'
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post(
  '/change-password',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({
          success: false,
          error: 'New password must be at least 8 characters.'
        });
        return;
      }

      const merchant = await Merchant.findById(req.merchant!._id).select('+password');

      if (!merchant) {
        res.status(404).json({
          success: false,
          error: 'Merchant not found.'
        });
        return;
      }

      // Verify current password
      const isMatch = await merchant.comparePassword(currentPassword);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          error: 'Current password is incorrect.'
        });
        return;
      }

      // Hash and save new password
      const salt = await bcryptjs.genSalt(12);
      merchant.password = await bcryptjs.hash(newPassword, salt);

      await merchant.save();

      // Generate new token
      const token = generateToken(merchant);

      res.json({
        success: true,
        message: 'Password changed successfully.',
        data: {
          token
        }
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password. Please try again.'
      });
    }
  }
);

export default router;
