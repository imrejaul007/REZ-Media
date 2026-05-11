// MongoDB initialization script
// This runs on first container startup

db = db.getSiblingDB('rez_marketing');

// Create indexes for optimal query performance
db.campaigns.createIndex({ merchantId: 1, status: 1 });
db.campaigns.createIndex({ createdAt: -1 });
db.campaigns.createIndex({ "segments.audienceId": 1 });

db.audiences.createIndex({ merchantId: 1 });
db.audiences.createIndex({ merchantId: 1, tags: 1 });
db.audiences.createIndex({ email: 1 }, { sparse: true });
db.audiences.createIndex({ phone: 1 }, { sparse: true });

db.broadcasts.createIndex({ campaignId: 1, status: 1 });
db.broadcasts.createIndex({ scheduledAt: 1 });
db.broadcasts.createIndex({ merchantId: 1, createdAt: -1 });

db.keywords.createIndex({ merchantId: 1, platform: 1 });
db.keywords.createIndex({ keyword: 1 });

db.analytics.createIndex({ merchantId: 1, date: -1 });
db.analytics.createIndex({ campaignId: 1, date: -1 });

db.vouchers.createIndex({ merchantId: 1, code: 1 }, { unique: true });
db.vouchers.createIndex({ campaignId: 1 });

// TTL index for temporary data (7 days)
db.tracking_events.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 });

print('MongoDB initialization complete for rez_marketing database');
