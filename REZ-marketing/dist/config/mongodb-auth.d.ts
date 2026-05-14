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
/**
 * Build MongoDB URI with authentication credentials
 * Supports both authenticated and unauthenticated connections
 */
export declare function buildMongoUri(): string;
/**
 * Connect to MongoDB with authentication support
 *
 * Authentication is automatically enabled when:
 * - MONGODB_USERNAME and MONGODB_PASSWORD are set, OR
 * - URI already contains credentials
 */
export declare function connectMongoDB(): Promise<void>;
/**
 * Gracefully disconnect from MongoDB
 */
export declare function disconnectMongoDB(): Promise<void>;
/**
 * Check if MongoDB is connected
 */
export declare function isMongoConnected(): boolean;
//# sourceMappingURL=mongodb-auth.d.ts.map