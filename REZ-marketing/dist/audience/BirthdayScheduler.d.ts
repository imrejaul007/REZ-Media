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
export declare function startBirthdayScheduler(): void;
//# sourceMappingURL=BirthdayScheduler.d.ts.map