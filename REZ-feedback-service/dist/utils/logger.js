"use strict";
/**
 * Local logger implementation for feedback service.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createServiceLogger = createServiceLogger;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        msg += `\n${stack}`;
    }
    return msg;
});
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
        }),
    ],
});
exports.logger = logger;
function createServiceLogger(serviceName) {
    return {
        info: (message, meta) => logger.info(message, { service: serviceName, ...meta }),
        error: (message, meta) => logger.error(message, { service: serviceName, ...meta }),
        warn: (message, meta) => logger.warn(message, { service: serviceName, ...meta }),
        debug: (message, meta) => logger.debug(message, { service: serviceName, ...meta }),
    };
}
//# sourceMappingURL=logger.js.map