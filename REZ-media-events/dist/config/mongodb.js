"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongoDB = connectMongoDB;
exports.disconnectMongoDB = disconnectMongoDB;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("./logger");
async function connectMongoDB() {
    // SECURITY FIX: Fail at startup if MONGODB_URI not set
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is required');
    }
    mongoose_1.default.set('strictQuery', false);
    mongoose_1.default.connection.on('connected', () => logger_1.logger.info('[MongoDB] Connected'));
    mongoose_1.default.connection.on('disconnected', () => logger_1.logger.warn('[MongoDB] Disconnected'));
    mongoose_1.default.connection.on('error', (err) => logger_1.logger.error('[MongoDB] Error: ' + err.message));
    await mongoose_1.default.connect(uri, {
        // IDX-1: Disable autoIndex in production (same pattern as monolith).
        // autoIndex=true would make every pod re-run ensureIndex() on boot,
        // stalling startup and racing on large collections. Index creation
        // is handled via one-off migration scripts in production.
        autoIndex: process.env.NODE_ENV !== 'production',
        autoCreate: process.env.NODE_ENV !== 'production',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
}
async function disconnectMongoDB() {
    await mongoose_1.default.disconnect();
}
//# sourceMappingURL=mongodb.js.map