"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Server
    port: parseInt(process.env.PORT || '4056', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    // MongoDB
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-crm-hub',
        options: {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        },
    },
    // Redis
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'rez:crm:',
    },
    // Internal Service Auth
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',
    // HubSpot OAuth
    hubspot: {
        clientId: process.env.HUBSPOT_CLIENT_ID || '',
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
        redirectUri: process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:4056/api/crm/hubspot/callback',
        authUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
        apiBaseUrl: 'https://api.hubapi.com',
    },
    // Zoho CRM OAuth
    zoho: {
        clientId: process.env.ZOHO_CLIENT_ID || '',
        clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
        redirectUri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:4056/api/crm/zoho/callback',
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        apiBaseUrl: 'https://www.zohoapis.com',
        dataCenter: process.env.ZOHO_DATA_CENTER || 'in',
    },
    // Sync Configuration
    sync: {
        intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10),
        batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
        retryAttempts: 3,
        retryDelayMs: 5000,
    },
    // Rate Limiting
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        max: 100,
    },
};
// Validate required config
function validateConfig() {
    const required = [
        { name: 'INTERNAL_SERVICE_TOKEN', value: exports.config.internalServiceToken },
        { name: 'MONGODB_URI', value: exports.config.mongodb.uri },
    ];
    const missing = required.filter(r => !r.value);
    if (missing.length > 0 && exports.config.nodeEnv === 'production') {
        throw new Error(`Missing required config: ${missing.map(m => m.name).join(', ')}`);
    }
}
exports.default = exports.config;
//# sourceMappingURL=index.js.map