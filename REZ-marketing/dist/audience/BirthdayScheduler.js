"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBirthdayScheduler = startBirthdayScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const bullmq_1 = require("bullmq");
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const birthdayQueue = new bullmq_1.Queue('mkt-campaigns', { connection: (0, redis_1.getRedisBullMQConnection)() });
/**
 * BirthdayScheduler — schedules birthday campaigns.
 *
 * Runs daily at 8 AM IST (2:30 AM UTC).
 * For each merchant with an active birthday campaign configuration,
 * enqueues a campaign dispatch job targeting users whose birthday is today
 * (or N days ahead, per merchant config).
 *
 * Campaign dispatch itself is handled by campaignWorker (BullMQ).
 *
 * Each BullMQ Queue instance connects to Redis independently — BullMQ uses the
 * queue *name* as the key prefix in Redis, so multiple Queue('mkt-campaigns')
 * instances share the same job stream. No duplicate sends occur.
 */
function startBirthdayScheduler() {
    // 8:00 AM IST = 2:30 AM UTC
    node_cron_1.default.schedule('30 2 * * *', async () => {
        logger_1.logger.info('[BirthdayScheduler] Running daily birthday campaign trigger');
        try {
            // Import here to avoid loading models before DB is connected
            const { MarketingCampaign } = await Promise.resolve().then(() => __importStar(require('../models/MarketingCampaign')));
            // Find all scheduled birthday campaigns (merchants who set up recurring birthday sends)
            const birthdayCampaigns = await MarketingCampaign.find({
                'audience.segment': 'birthday',
                status: 'scheduled',
            }).lean();
            logger_1.logger.info('[BirthdayScheduler] Found birthday campaigns', { count: birthdayCampaigns.length });
            for (const campaign of birthdayCampaigns) {
                await birthdayQueue.add('dispatch', {
                    campaignId: campaign._id.toString(),
                    merchantId: campaign.merchantId.toString(),
                    message: campaign.message,
                    triggeredBy: 'birthday_scheduler',
                }, {
                    jobId: `birthday-${campaign._id}-${todayKey()}`,
                    removeOnComplete: { age: 7 * 86400 },
                    removeOnFail: { age: 30 * 86400 },
                });
            }
            logger_1.logger.info('[BirthdayScheduler] Birthday jobs enqueued', { count: birthdayCampaigns.length });
        }
        catch (err) {
            logger_1.logger.error('[BirthdayScheduler] Cron failed', { err: err.message });
        }
    });
    logger_1.logger.info('[BirthdayScheduler] Scheduled — runs daily at 8:00 AM IST');
}
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
//# sourceMappingURL=BirthdayScheduler.js.map