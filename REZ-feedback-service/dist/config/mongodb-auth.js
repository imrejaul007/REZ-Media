"use strict";
/**
 * MongoDB Connection with Authentication Support
 *
 * CRITICAL SECURITY: This module supports MongoDB authentication.
 * Enable by setting MONGODB_USERNAME and MONGODB_PASSWORD env vars.
 *
 * Usage:
 *   1. Set environment variables:
 *      MONGODB_USERNAME=your_username
 *      MONGODB_PASSWORD=your_password
 *      MONGODB_AUTH_SOURCE=admin (default)
 *
 *   2. Update MONGODB_URI to include authSource:
 *      mongodb+srv://cluster.mongodb.net/database?authSource=admin
 *
 * For MongoDB Atlas:
 *   1. Create database user in Atlas Security > Database Access
 *   2. Add user credentials to MONGODB_URI:
 *      mongodb+srv://username:password@cluster.mongodb.net/database?authSource=admin
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMongoUri = buildMongoUri;
exports.connectMongoDB = connectMongoDB;
exports.disconnectMongoDB = disconnectMongoDB;
exports.isMongoConnected = isMongoConnected;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("./logger");
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
/**
 * Build MongoDB URI with authentication credentials
 * Supports both authenticated and unauthenticated connections
 */
function buildMongoUri() {
    let baseUri = process.env.MONGODB_URI || '';
    if (!baseUri) {
        throw new Error('[MongoDB] MONGODB_URI environment variable is not set');
    }
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;
    // If credentials are provided, inject them into the URI
    if (username && password) {
        // Handle mongodb+srv:// protocol
        if (baseUri.startsWith('mongodb+srv://')) {
            // Remove existing credentials if any
            baseUri = baseUri.replace(/:\/\/[^@]+@/, '://');
            // Insert credentials after ://
            baseUri = baseUri.replace('mongodb+srv://', `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
        }
        // Handle mongodb:// protocol
        else if (baseUri.startsWith('mongodb://')) {
            baseUri = baseUri.replace(/:\/\/[^@]+@/, '://');
            baseUri = baseUri.replace('mongodb://', `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
        }
    }
    return baseUri;
}
/**
 * Extract replica set name from URI for connection options
 */
function extractReplicaSetName(uri) {
    const match = uri.match(/replicaSet=([^&]+)/);
    return match ? match[1] : undefined;
}
/**
 * Mask URI for logging (hide credentials)
 */
function maskUri(uri) {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}
/**
 * Connect to MongoDB with authentication support
 *
 * Authentication is automatically enabled when:
 * - MONGODB_USERNAME and MONGODB_PASSWORD are set, OR
 * - URI already contains credentials
 */
async function connectMongoDB() {
    const uri = buildMongoUri();
    const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
    const hasCredentials = !!(process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD);
    if (hasCredentials) {
        logger_1.logger.info('[MongoDB] Authentication enabled (credentials from env vars)');
    }
    const options = {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        replicaSet: extractReplicaSetName(uri),
        readPreference: (process.env.MONGODB_READ_PREFERENCE || 'primary'),
        authSource: authSource,
    };
    mongoose_1.default.connection.on('connected', () => logger_1.logger.info('[MongoDB] Connected', { uri: maskUri(uri) }));
    mongoose_1.default.connection.on('disconnected', () => logger_1.logger.warn('[MongoDB] Disconnected'));
    mongoose_1.default.connection.on('error', (err) => logger_1.logger.error('[MongoDB] Error: ' + err.message));
    mongoose_1.default.connection.on('reconnected', () => logger_1.logger.info('[MongoDB] Reconnected'));
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose_1.default.connect(uri, options);
            logger_1.logger.info('[MongoDB] Connected successfully', {
                attempt,
                replicaSet: options.replicaSet || 'none',
                readPreference: options.readPreference,
                authEnabled: hasCredentials,
            });
            return;
        }
        catch (err) {
            logger_1.logger.error(`[MongoDB] Connection attempt ${attempt}/${MAX_RETRIES} failed`, {
                error: err instanceof Error ? err.message : String(err),
            });
            if (attempt === MAX_RETRIES) {
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
    }
}
/**
 * Gracefully disconnect from MongoDB
 */
async function disconnectMongoDB() {
    try {
        await mongoose_1.default.disconnect();
        logger_1.logger.info('[MongoDB] Disconnected gracefully');
    }
    catch (err) {
        logger_1.logger.error('[MongoDB] Error during disconnect', { error: err instanceof Error ? err.message : String(err) });
    }
}
/**
 * Check if MongoDB is connected
 */
function isMongoConnected() {
    return mongoose_1.default.connection.readyState === 1;
}
//# sourceMappingURL=mongodb-auth.js.map