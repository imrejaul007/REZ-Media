/**
 * Offline Cache Service for Karma Mobile
 * Provides caching layer with AsyncStorage for offline support
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@karma_cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  timestamp: number;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = `${CACHE_PREFIX}offline_queue`;
const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_COUNT = 3;

/**
 * Cache a value with optional TTL
 */
export async function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  };
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error('[Cache] Error setting cache:', key, error);
  }
}

/**
 * Get cached value if not expired
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      // Clean up expired entry
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('[Cache] Error getting cache:', key, error);
    return null;
  }
}

/**
 * Remove a cached value
 */
export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('[Cache] Error removing cache:', key, error);
  }
}

/**
 * Clear all cached values
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
    console.log('[Cache] Cleared all cache entries');
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}

/**
 * Add request to offline queue
 */
export async function queueRequest(
  url: string,
  method: QueuedRequest['method'],
  data?: unknown
): Promise<void> {
  try {
    const queue = await getOfflineQueue();

    // Prevent duplicate requests
    const isDuplicate = queue.some(
      (q) => q.url === url && q.data === data && Date.now() - q.timestamp < 60000
    );
    if (isDuplicate) return;

    const request: QueuedRequest = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    queue.push(request);

    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[Cache] Request queued for offline:', method, url);
  } catch (error) {
    console.error('[Cache] Error queueing request:', error);
  }
}

/**
 * Get all queued requests
 */
export async function getOfflineQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('[Cache] Error getting offline queue:', error);
    return [];
  }
}

/**
 * Remove request from queue
 */
export async function removeFromQueue(requestId: string): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    const filtered = queue.filter((q) => q.id !== requestId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[Cache] Error removing from queue:', error);
  }
}

/**
 * Clear the entire offline queue
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('[Cache] Cleared offline queue');
  } catch (error) {
    console.error('[Cache] Error clearing queue:', error);
  }
}

/**
 * Get offline queue size
 */
export async function getQueueSize(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}

/**
 * Check if there are pending offline requests
 */
export async function hasPendingRequests(): Promise<boolean> {
  const size = await getQueueSize();
  return size > 0;
}

// Cache keys for common API responses
export const CACHE_KEYS = {
  KARMA_PROFILE: 'karma_profile',
  KARMA_HISTORY: 'karma_history',
  EVENTS: 'events',
  EVENT_DETAIL: (id: string) => `event_${id}`,
  WALLET_BALANCE: 'wallet_balance',
  TRANSACTIONS: 'transactions',
  COMMUNITIES: 'communities',
  COMMUNITY: (slug: string) => `community_${slug}`,
  LEADERBOARD: 'leaderboard',
  MISSIONS: 'missions',
  MICRO_ACTIONS: 'micro_actions',
  BOOKINGS: 'bookings',
} as const;
