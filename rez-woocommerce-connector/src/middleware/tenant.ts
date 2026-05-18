/**
 * Tenant Middleware (Multi-Tenant Support)
 *
 * Express middleware for extracting and enforcing tenant context.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

// Tenant context interface
export interface TenantContext {
  tenantId: string;
  brandId: string;
  plan?: string;
}

/**
 * Extract tenant context from request headers
 *
 * Headers:
 * - X-Tenant-Id: Tenant identifier
 * - X-Brand-Id: Brand identifier
 * - X-Plan: (optional) Subscription plan
 */
export function extractTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantId = req.headers['x-tenant-id'] as string;
  const brandId = req.headers['x-brand-id'] as string;

  if (tenantId && brandId) {
    req.tenant = {
      tenantId,
      brandId,
      plan: req.headers['x-plan'] as string,
    };

    logger.debug('[Tenant] Context extracted', {
      tenantId,
      brandId,
      path: req.path,
    });
  }

  next();
}

/**
 * Require tenant context middleware
 *
 * Use this for routes that MUST have tenant context.
 * Returns 401 if tenant headers are missing.
 */
export function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant?.tenantId || !req.tenant?.brandId) {
    logger.warn('[Tenant] Missing tenant context', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'TENANT_REQUIRED',
        message: 'Tenant context is required. Include X-Tenant-Id and X-Brand-Id headers.',
      },
    });
    return;
  }

  next();
}

/**
 * Optional tenant context - sets tenant if present but doesn't require
 */
export function optionalTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantId = req.headers['x-tenant-id'] as string;
  const brandId = req.headers['x-brand-id'] as string;

  if (tenantId && brandId) {
    req.tenant = {
      tenantId,
      brandId,
      plan: req.headers['x-plan'] as string,
    };
  }

  next();
}

/**
 * Create tenant-scoped query helper
 *
 * Use this to ensure all queries include tenant isolation.
 */
export function createTenantScopedQuery(
  tenant: TenantContext,
  baseQuery: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...baseQuery,
    tenantId: tenant.tenantId,
    brandId: tenant.brandId,
  };
}

/**
 * Verify tenant owns a store
 *
 * Use this before accessing store-specific operations.
 */
export async function verifyStoreOwnership(
  tenantId: string,
  brandId: string,
  store: { tenantId: string; brandId: string }
): Promise<boolean> {
  if (store.tenantId !== tenantId) {
    logger.warn('[Tenant] Store ownership verification failed', {
      requestedTenantId: tenantId,
      actualTenantId: store.tenantId,
    });
    return false;
  }

  if (store.brandId !== brandId) {
    logger.warn('[Tenant] Brand ownership verification failed', {
      requestedBrandId: brandId,
      actualBrandId: store.brandId,
    });
    return false;
  }

  return true;
}

/**
 * Audit middleware for tenant-scoped requests
 */
export function tenantAuditMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.tenant) {
    logger.info('[Tenant] Tenant-scoped request', {
      tenantId: req.tenant.tenantId,
      brandId: req.tenant.brandId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
  }
  next();
}
