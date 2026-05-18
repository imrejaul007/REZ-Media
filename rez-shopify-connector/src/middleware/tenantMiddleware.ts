import { Request, Response, NextFunction } from 'express';
import { logger } from '../config';

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
 * In production, this would validate against the multitenant-core service
 */
export function extractTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Try to get tenant from various sources (in order of priority):
  // 1. X-Tenant-Id header (from internal services)
  // 2. X-Brand-Id header
  // 3. JWT token (if implementing full auth)

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
 * Use this for routes that MUST have tenant context
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
 * Use this to ensure all queries include tenant isolation
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
 * Use this before accessing store-specific operations
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
