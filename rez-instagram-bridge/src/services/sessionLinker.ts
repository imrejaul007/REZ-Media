import { InstagramSession } from '../models/InstagramSession';
import { InstagramUser } from '../models/InstagramUser';
import { config } from '../config';
import axios from 'axios';
import crypto from 'crypto';
import winston from 'winston';
import { Types } from 'mongoose';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface LinkSessionRequest {
  instagramUserId: string;
  username: string;
  email?: string;
  phone?: string;
  source?: string;
  referrer?: string;
  context?: {
    intent?: string;
    conversationId?: string;
    messageId?: string;
    mediaId?: string;
    commentId?: string;
  };
}

export interface LinkSessionResponse {
  success: boolean;
  sessionId?: string;
  verificationCode?: string;
  expiresAt?: Date;
  error?: string;
}

export interface VerifyLinkRequest {
  verificationCode: string;
}

export interface VerifyLinkResponse {
  success: boolean;
  rezUserId?: string;
  instagramUserId?: string;
  error?: string;
}

class SessionLinker {
  private readonly codeLength = 6;

  async createLinkSession(request: LinkSessionRequest): Promise<LinkSessionResponse> {
    try {
      // Generate verification code
      const verificationCode = this.generateVerificationCode();
      const sessionId = crypto.randomUUID();

      // Get or create Instagram user
      let user = await InstagramUser.findOne({ instagramId: request.instagramUserId });

      if (!user) {
        user = new InstagramUser({
          instagramId: request.instagramUserId,
          username: request.username,
          displayName: request.username,
          email: request.email,
          phone: request.phone,
        });
        await user.save();
      } else {
        // Update contact info if provided
        if (request.email) user.email = request.email;
        if (request.phone) user.phone = request.phone;
        await user.save();
      }

      // Expire any existing pending sessions
      await InstagramSession.expireSessions(user._id as Types.ObjectId);

      // Create new session
      const expiresAt = new Date(Date.now() + config.session.linkExpiry);

      const session = new InstagramSession({
        sessionId,
        instagramUserId: user._id as Types.ObjectId,
        platformUserId: request.instagramUserId,
        username: request.username,
        email: request.email,
        phone: request.phone,
        verificationCode,
        status: 'pending',
        expiresAt,
        metadata: {
          source: request.source,
          referrer: request.referrer,
        },
        linkContext: request.context,
      });

      await session.save();

      logger.info('Link session created', {
        sessionId,
        instagramUserId: request.instagramUserId,
        username: request.username,
      });

      return {
        success: true,
        sessionId,
        verificationCode,
        expiresAt,
      };
    } catch (error: any) {
      logger.error('Failed to create link session', {
        instagramUserId: request.instagramUserId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async verifyLink(request: VerifyLinkRequest): Promise<VerifyLinkResponse> {
    try {
      const session = await InstagramSession.findOne({
        verificationCode: request.verificationCode,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        logger.warn('Invalid or expired verification code', {
          verificationCode: request.verificationCode,
        });
        return {
          success: false,
          error: 'Invalid or expired verification code',
        };
      }

      // Check if max attempts exceeded
      if (!session.canRetryVerification(config.session.maxAttempts)) {
        session.status = 'failed';
        await session.save();

        return {
          success: false,
          error: 'Maximum verification attempts exceeded',
        };
      }

      // Increment attempt count
      await InstagramSession.incrementVerificationAttempts(session.sessionId);

      // Create user in REZ if email provided
      let rezUserId: string | null = null;

      if (session.email) {
        const createResult = await this.createRezUser({
          email: session.email,
          username: session.username,
          phone: session.phone,
          platform: 'instagram',
          platformUserId: session.platformUserId,
        });

        if (createResult.success && createResult.rezUserId) {
          rezUserId = createResult.rezUserId;
        } else {
          // If REZ user creation fails, we can still link by phone
          if (session.phone) {
            const linkResult = await this.linkByPhone(session.phone, session.instagramUserId.toString());
            if (linkResult.success && linkResult.rezUserId) {
              rezUserId = linkResult.rezUserId;
            }
          }
        }
      }

      // Complete the session
      if (rezUserId) {
        await InstagramSession.completeSession(session.sessionId, rezUserId);

        // Update Instagram user with REZ user ID
        await InstagramUser.findByIdAndUpdate(session.instagramUserId, {
          linkedRezUserId: rezUserId,
          linkedAt: new Date(),
        });

        logger.info('Session linked successfully', {
          sessionId: session.sessionId,
          rezUserId,
          instagramUserId: session.platformUserId,
        });

        return {
          success: true,
          rezUserId,
          instagramUserId: session.platformUserId,
        };
      }

      return {
        success: false,
        error: 'Could not link to REZ account. Please provide email or phone.',
      };
    } catch (error: any) {
      logger.error('Failed to verify link', {
        verificationCode: request.verificationCode,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private generateVerificationCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < this.codeLength; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }

  private async createRezUser(request: {
    email: string;
    username: string;
    phone?: string;
    platform: string;
    platformUserId: string;
  }): Promise<{ success: boolean; rezUserId?: string; error?: string }> {
    try {
      const orchestratorUrl = config.orchestrator.url;
      const token = this.getServiceToken('orchestrator');

      const response = await axios.post(
        `${orchestratorUrl}/api/users/external-link`,
        {
          email: request.email,
          username: request.username,
          phone: request.phone,
          externalIdentities: [
            {
              platform: request.platform,
              platformUserId: request.platformUserId,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': token,
          },
          timeout: config.orchestrator.timeout,
        }
      );

      if (response.data.success && response.data.userId) {
        return {
          success: true,
          rezUserId: response.data.userId,
        };
      }

      return {
        success: false,
        error: response.data.error || 'Failed to create user',
      };
    } catch (error: any) {
      logger.error('Failed to create REZ user', {
        email: request.email,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async linkByPhone(
    phone: string,
    instagramUserId: string
  ): Promise<{ success: boolean; rezUserId?: string; error?: string }> {
    try {
      const orchestratorUrl = config.orchestrator.url;
      const token = this.getServiceToken('orchestrator');

      const response = await axios.post(
        `${orchestratorUrl}/api/users/link-by-phone`,
        {
          phone,
          externalIdentity: {
            platform: 'instagram',
            platformUserId: instagramUserId,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': token,
          },
          timeout: config.orchestrator.timeout,
        }
      );

      if (response.data.success && response.data.userId) {
        return {
          success: true,
          rezUserId: response.data.userId,
        };
      }

      return {
        success: false,
        error: response.data.error || 'Failed to link by phone',
      };
    } catch (error: any) {
      logger.error('Failed to link by phone', {
        phone,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getServiceToken(serviceName: string): string {
    try {
      const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
      const tokens = JSON.parse(tokensJson);
      return tokens[serviceName] || '';
    } catch {
      return '';
    }
  }

  async getSessionStatus(sessionId: string): Promise<{
    status: string;
    expiresAt: Date;
    attemptsRemaining: number;
  } | null> {
    const session = await InstagramSession.findBySessionId(sessionId);

    if (!session) {
      return null;
    }

    return {
      status: session.status,
      expiresAt: session.expiresAt,
      attemptsRemaining: Math.max(0, config.session.maxAttempts - session.verificationAttempts),
    };
  }

  async resendVerificationCode(sessionId: string): Promise<{
    success: boolean;
    verificationCode?: string;
    error?: string;
  }> {
    try {
      const session = await InstagramSession.findBySessionId(sessionId);

      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      if (session.status !== 'pending') {
        return { success: false, error: 'Session is not pending' };
      }

      if (session.isExpired()) {
        return { success: false, error: 'Session has expired' };
      }

      // Generate new code
      const verificationCode = this.generateVerificationCode();
      session.verificationCode = verificationCode;
      session.verificationAttempts = 0;
      await session.save();

      logger.info('Verification code resent', { sessionId });

      return {
        success: true,
        verificationCode,
      };
    } catch (error: any) {
      logger.error('Failed to resend verification code', {
        sessionId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const sessionLinker = new SessionLinker();
