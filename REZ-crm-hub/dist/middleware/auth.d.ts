import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            internalServiceAuthenticated?: boolean;
        }
    }
}
/**
 * Middleware to verify internal service token
 */
export declare function internalAuthMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Optional internal auth - doesn't fail if token is missing
 */
export declare function optionalInternalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void;
export default internalAuthMiddleware;
//# sourceMappingURL=auth.d.ts.map