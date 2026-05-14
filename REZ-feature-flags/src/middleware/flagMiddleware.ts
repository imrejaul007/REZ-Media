import { Request, Response, NextFunction, RequestHandler } from 'express';
import { FlagService } from '../services/flagService';
import { UserContext } from '../types/flag';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      flagContext?: {
        userId?: string;
        attributes?: Record<string, unknown>;
        environment: string;
      };
      flagEvaluations?: Record<string, boolean>;
    }
  }
}

export interface FlagMiddlewareOptions {
  flagService: FlagService;
  defaultEnvironment?: string;
  userIdHeader?: string;
  cacheFlags?: boolean;
}

// Create middleware instance with options
export function createFlagMiddleware(options: FlagMiddlewareOptions): {
  extractContext: RequestHandler;
  evaluateFlags: (flagKeys: string[]) => RequestHandler;
  requireFlags: (flagKeys: string[]) => RequestHandler;
  attachFlags: (flagKeys: string[]) => RequestHandler;
} {
  const {
    flagService,
    defaultEnvironment = 'production',
    userIdHeader = 'x-user-id',
    cacheFlags = true,
  } = options;

  /**
   * Extract user context from request headers/cookies
   * Populates req.flagContext with userId, attributes, and environment
   */
  const extractContext: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers[userIdHeader] as string ||
                   req.cookies?.userId ||
                   req.query?.userId as string ||
                   'anonymous';

    // Extract environment from header, query, or default
    const environment = (req.headers['x-environment'] as string ||
                        req.query?.environment as string ||
                        defaultEnvironment) as string;

    // Extract user attributes from various sources
    const attributes: Record<string, unknown> = {
      ...req.query?.attributes,
    };

    // Extract from custom header (base64 encoded JSON)
    const attributesHeader = req.headers['x-user-attributes'];
    if (attributesHeader) {
      try {
        const decoded = Buffer.from(attributesHeader as string, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        Object.assign(attributes, parsed);
      } catch {
        // Ignore malformed attributes header
      }
    }

    req.flagContext = {
      userId,
      attributes,
      environment,
    };

    next();
  };

  /**
   * Evaluate specific flags and attach results to request
   * Returns middleware that evaluates the specified flags
   */
  const evaluateFlags = (flagKeys: string[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.flagContext) {
        // If extractContext hasn't run, run it now
        const userId = req.headers[userIdHeader] as string || 'anonymous';
        const environment = (req.headers['x-environment'] as string || defaultEnvironment) as string;

        req.flagContext = {
          userId,
          environment,
        };
      }

      try {
        const userContext: UserContext = {
          id: req.flagContext.userId || 'anonymous',
          attributes: req.flagContext.attributes,
        };

        const results = await flagService.evaluateFlags(
          flagKeys,
          userContext,
          req.flagContext.environment
        );

        // Attach evaluations to request
        req.flagEvaluations = {};
        for (const [key, evaluation] of Object.entries(results)) {
          req.flagEvaluations[key] = evaluation.enabled;
        }

        // Also attach full evaluation results
        res.locals.flagResults = results;

      } catch (error) {
        console.error('Flag evaluation error:', error);
        // On error, set all flags to false for safety
        req.flagEvaluations = {};
        for (const key of flagKeys) {
          req.flagEvaluations[key] = false;
        }
        res.locals.flagResults = null;
      }

      next();
    };
  };

  /**
   * Require specific flags to be enabled
   * Returns 403 if any required flag is disabled
   */
  const requireFlags = (flagKeys: string[]): RequestHandler => {
    const evaluator = evaluateFlags(flagKeys);

    return async (req: Request, res: Response, next: NextFunction) => {
      // First evaluate the flags
      await new Promise<void>((resolve, reject) => {
        evaluator(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Check if all required flags are enabled
      const disabledFlags = flagKeys.filter(key => !req.flagEvaluations?.[key]);

      if (disabledFlags.length > 0) {
        res.status(403).json({
          error: 'Feature not available',
          message: 'One or more required features are currently disabled',
          disabledFlags,
        });
        return;
      }

      next();
    };
  };

  /**
   * Attach flag states to response headers
   * Useful for debugging and client-side visibility
   */
  const attachFlags = (flagKeys: string[]): RequestHandler => {
    const evaluator = evaluateFlags(flagKeys);

    return async (req: Request, res: Response, next: NextFunction) => {
      // First evaluate the flags
      await new Promise<void>((resolve, reject) => {
        evaluator(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Attach flag states to response headers
      if (req.flagEvaluations) {
        res.setHeader('X-Feature-Flags', JSON.stringify(req.flagEvaluations));

        for (const [key, enabled] of Object.entries(req.flagEvaluations)) {
          res.setHeader(`X-Flag-${key}`, enabled ? 'enabled' : 'disabled');
        }
      }

      next();
    };
  };

  return {
    extractContext,
    evaluateFlags,
    requireFlags,
    attachFlags,
  };
}

/**
 * Simple check if a flag is enabled for a user
 */
export async function isFlagEnabled(
  flagService: FlagService,
  flagKey: string,
  userId: string,
  attributes?: Record<string, unknown>,
  environment: string = 'production'
): Promise<boolean> {
  const result = await flagService.evaluateFlag(
    flagKey,
    { id: userId, attributes },
    environment
  );
  return result.enabled;
}

/**
 * Get flag value for a user
 */
export async function getFlagValue<T = unknown>(
  flagService: FlagService,
  flagKey: string,
  userId: string,
  attributes?: Record<string, unknown>,
  environment: string = 'production'
): Promise<T | null> {
  const result = await flagService.evaluateFlag(
    flagKey,
    { id: userId, attributes },
    environment
  );

  if (!result.enabled || !result.variation) {
    return null;
  }

  return result.variation.value as T;
}

/**
 * Batch check multiple flags
 */
export async function areFlagsEnabled(
  flagService: FlagService,
  flagKeys: string[],
  userId: string,
  attributes?: Record<string, unknown>,
  environment: string = 'production'
): Promise<Record<string, boolean>> {
  const results = await flagService.evaluateFlags(
    flagKeys,
    { id: userId, attributes },
    environment
  );

  const enabled: Record<string, boolean> = {};
  for (const [key, evaluation] of Object.entries(results)) {
    enabled[key] = evaluation.enabled;
  }

  return enabled;
}

// Express request handler type for flag middleware
export type FlagMiddlewareHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
