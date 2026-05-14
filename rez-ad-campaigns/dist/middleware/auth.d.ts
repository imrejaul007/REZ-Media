import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            merchantId?: string;
            isAdmin?: boolean;
        }
    }
}
export declare function verifyConsumer(req: Request, res: Response, next: NextFunction): void;
export declare function verifyMerchant(req: Request, res: Response, next: NextFunction): void;
export declare function verifyAdmin(req: Request, res: Response, next: NextFunction): void;
export declare function verifyInternal(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map