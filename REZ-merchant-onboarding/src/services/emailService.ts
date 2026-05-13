import nodemailer from 'nodemailer';
import { IMerchant } from '../models/Merchant';

const logger = {
  info: (message: string, meta?: object) => {
    console.log(`[EMAIL] ${message}`, meta || '');
  },
  error: (message: string, meta?: object) => {
    console.error(`[EMAIL ERROR] ${message}`, meta || '');
  }
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create transporter
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@rez.com';

export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"ReZ Platform" <${EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, '')
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  static async sendVerificationEmail(merchant: IMerchant): Promise<boolean> {
    const verificationUrl = `${FRONTEND_URL}/verify-email/${merchant.emailVerificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .warning { background: #fef3cd; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ReZ!</h1>
          </div>
          <div class="content">
            <h2>Hi ${merchant.fullName},</h2>
            <p>Thank you for registering as a merchant on ReZ. Please verify your email address to continue.</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${verificationUrl}</p>
            <div class="warning">
              <strong>Note:</strong> This verification link will expire in 24 hours.
            </div>
            <p>If you didn't create an account with ReZ, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>ReZ Platform - Building the future of commerce</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: merchant.email,
      subject: 'Verify your ReZ merchant account',
      html
    });
  }

  static async sendApprovalEmail(merchant: IMerchant): Promise<boolean> {
    const loginUrl = `${FRONTEND_URL}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Congratulations!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10B981; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Congratulations!</h1>
          </div>
          <div class="content">
            <h2>Hi ${merchant.fullName},</h2>
            <p>Great news! Your merchant account has been <strong>approved</strong>.</p>
            <p>You can now access all merchant features on the ReZ platform:</p>
            <ul>
              <li>List your products and services</li>
              <li>Accept orders and payments</li>
              <li>Access merchant dashboard and analytics</li>
              <li>And much more!</li>
            </ul>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="button">Go to Dashboard</a>
            </p>
            <p>Welcome aboard, and we look forward to growing together!</p>
          </div>
          <div class="footer">
            <p>ReZ Platform - Building the future of commerce</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: merchant.email,
      subject: 'Your ReZ merchant account is approved!',
      html
    });
  }

  static async sendRejectionEmail(merchant: IMerchant, reason: string): Promise<boolean> {
    const supportUrl = `${FRONTEND_URL}/support`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Application Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .reason-box { background: #fee2e2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { display: inline-block; background: #4F46E5; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Update</h1>
          </div>
          <div class="content">
            <h2>Hi ${merchant.fullName},</h2>
            <p>Thank you for your patience while we reviewed your merchant application.</p>
            <p>After careful review, we were unable to approve your application at this time.</p>
            <div class="reason-box">
              <strong>Reason:</strong><br>
              ${reason}
            </div>
            <p>You may reapply after addressing the issues mentioned above. If you believe this was a mistake or need assistance, please contact our support team.</p>
            <p style="text-align: center;">
              <a href="${supportUrl}" class="button">Contact Support</a>
            </p>
          </div>
          <div class="footer">
            <p>ReZ Platform - Building the future of commerce</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: merchant.email,
      subject: 'Update on your ReZ merchant application',
      html
    });
  }

  static async sendKYCRevisionRequestEmail(merchant: IMerchant, reason: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>KYC Documents Update Required</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .reason-box { background: #fef3cd; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { display: inline-block; background: #F59E0B; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Action Required</h1>
          </div>
          <div class="content">
            <h2>Hi ${merchant.fullName},</h2>
            <p>We have reviewed your KYC documents and need some additional information.</p>
            <div class="reason-box">
              <strong>Changes requested:</strong><br>
              ${reason}
            </div>
            <p>Please resubmit your KYC documents with the required changes.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>ReZ Platform - Building the future of commerce</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: merchant.email,
      subject: 'Action required: Update your KYC documents',
      html
    });
  }
}

export default EmailService;
