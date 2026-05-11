/**
 * BullMQ Workers
 *
 * Async job processing
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';

// Redis connection for BullMQ
const connection = new Redis({
  host: config.BULLMQ_REDIS_HOST,
  port: config.BULLMQ_REDIS_PORT
});

// ============================================
// QUEUES
// ============================================

// Event processing queue
export const eventQueue = new Queue('event-processing', { connection });

// Karma calculation queue
export const karmaQueue = new Queue('karma-calculation', { connection });

// Coin credit queue
export const coinQueue = new Queue('coin-credit', { connection });

// Notification queue
export const notificationQueue = new Queue('notifications', { connection });

// ============================================
// EVENT PROCESSING WORKER
// ============================================

export function startEventWorker() {
  const worker = new Worker(
    'event-processing',
    async (job: Job) => {
      console.log(`[EventWorker] Processing job ${job.id}`);

      const { eventId, eventType, userId, data } = job.data;

      // Process the event
      // In real implementation, this would:
      // 1. Fetch event from database
      // 2. Evaluate rules
      // 3. Trigger actions
      // 4. Update event status

      console.log(`[EventWorker] Processed event ${eventId}`);

      return { success: true, eventId };
    },
    { connection, concurrency: 5 }
  );

  worker.on('completed', (job) => {
    console.log(`[EventWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EventWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// ============================================
// KARMA CALCULATION WORKER
// ============================================

export function startKarmaWorker() {
  const worker = new Worker(
    'karma-calculation',
    async (job: Job) => {
      console.log(`[KarmaWorker] Processing job ${job.id}`);

      const { userId, action } = job.data;

      // Calculate karma based on action
      // In real implementation, this would:
      // 1. Fetch user karma data
      // 2. Calculate new karma score
      // 3. Update karma profile
      // 4. Update percentile ranking

      console.log(`[KarmaWorker] Calculated karma for user ${userId}`);

      return { success: true, userId };
    },
    { connection, concurrency: 3 }
  );

  worker.on('completed', (job) => {
    console.log(`[KarmaWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[KarmaWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// ============================================
// COIN CREDIT WORKER
// ============================================

export function startCoinWorker() {
  const worker = new Worker(
    'coin-credit',
    async (job: Job) => {
      console.log(`[CoinWorker] Processing job ${job.id}`);

      const { userId, coinType, amount, source, metadata } = job.data;

      // Credit coins to wallet
      // In real implementation, this would:
      // 1. Call wallet service API
      // 2. Record transaction
      // 3. Send notification

      console.log(`[CoinWorker] Credited ${amount} ${coinType} to user ${userId}`);

      return { success: true, userId, amount, coinType };
    },
    { connection, concurrency: 10 }
  );

  worker.on('completed', (job) => {
    console.log(`[CoinWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[CoinWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// ============================================
// NOTIFICATION WORKER
// ============================================

export function startNotificationWorker() {
  const worker = new Worker(
    'notifications',
    async (job: Job) => {
      console.log(`[NotificationWorker] Processing job ${job.id}`);

      const { userId, type, title, body, data } = job.data;

      // Send notification
      // In real implementation, this would:
      // 1. Fetch user push tokens
      // 2. Send push notification
      // 3. Record notification sent

      console.log(`[NotificationWorker] Sent ${type} to user ${userId}`);

      return { success: true, userId };
    },
    { connection, concurrency: 20 }
  );

  worker.on('completed', (job) => {
    console.log(`[NotificationWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// ============================================
// START ALL WORKERS
// ============================================

export function startAllWorkers() {
  console.log('[Workers] Starting all workers...');

  const workers = [
    startEventWorker(),
    startKarmaWorker(),
    startCoinWorker(),
    startNotificationWorker()
  ];

  console.log('[Workers] All workers started');

  return workers;
}

// ============================================
// JOB HELPERS
// ============================================

/**
 * Add event to processing queue
 */
export async function queueEvent(eventId: string, eventType: string, userId: string, data: any) {
  return eventQueue.add(
    'process-event',
    { eventId, eventType, userId, data },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
}

/**
 * Add karma calculation to queue
 */
export async function queueKarmaCalculation(userId: string, action: string) {
  return karmaQueue.add(
    'calculate-karma',
    { userId, action },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
}

/**
 * Add coin credit to queue
 */
export async function queueCoinCredit(
  userId: string,
  coinType: string,
  amount: number,
  source: string,
  metadata?: any
) {
  return coinQueue.add(
    'credit-coins',
    { userId, coinType, amount, source, metadata },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
}

/**
 * Add notification to queue
 */
export async function queueNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: any
) {
  return notificationQueue.add(
    'send-notification',
    { userId, type, title, body, data },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
}

// ============================================
// SHUTDOWN
// ============================================

export async function shutdownWorkers() {
  console.log('[Workers] Shutting down...');

  await eventQueue.close();
  await karmaQueue.close();
  await coinQueue.close();
  await notificationQueue.close();
  await connection.quit();

  console.log('[Workers] All workers shut down');
}
