"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
// @ts-nocheck
const winston_1 = require("winston");
exports.logger = (0, winston_1.createLogger)({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.errors({ stack: true }), process.env.NODE_ENV === 'production'
        ? winston_1.format.json()
        : winston_1.format.combine(winston_1.format.colorize(), winston_1.format.simple())),
    defaultMeta: { service: 'rez-ads-service' },
    transports: [new winston_1.transports.Console()],
});
//# sourceMappingURL=logger.js.map