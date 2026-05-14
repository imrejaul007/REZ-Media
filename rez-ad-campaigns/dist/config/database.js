"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
// @ts-nocheck
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("./logger");
async function connectDB() {
    const uri = process.env.ADS_MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri)
        throw new Error('ADS_MONGO_URI, MONGO_URI, or MONGODB_URI is required');
    await mongoose_1.default.connect(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        w: 'majority',
    });
    logger_1.logger.info('[DB] Connected to MongoDB');
    mongoose_1.default.connection.on('error', (err) => {
        logger_1.logger.error('[DB] MongoDB error:', err);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        logger_1.logger.warn('[DB] MongoDB disconnected — will auto-reconnect');
    });
}
//# sourceMappingURL=database.js.map