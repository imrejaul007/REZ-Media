/**
 * Local logger implementation for feedback service.
 * Uses winston for structured logging.
 */
import winston from 'winston';
declare const logger: winston.Logger;
export { logger };
export declare function createServiceLogger(serviceName: string): {
    info: (message: string, meta?: object) => winston.Logger;
    error: (message: string, meta?: object) => winston.Logger;
    warn: (message: string, meta?: object) => winston.Logger;
    debug: (message: string, meta?: object) => winston.Logger;
};
//# sourceMappingURL=logger.d.ts.map