import Redis from 'ioredis';

// ============================================
// REDIS CLIENT WITH CONNECTION MANAGEMENT
// ============================================

const REDIS_MAX_RETRIES = 3;
const REDIS_INITIAL_RETRY_DELAY_MS = 100;

let redis: Redis;
let isConnected = false;

/**
 * Create Redis client with retry logic
 */
function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > REDIS_MAX_RETRIES) {
        return null; // Stop retrying
      }
      return Math.min(REDIS_INITIAL_RETRY_DELAY_MS * Math.pow(2, times - 1), 2000);
    },
    lazyConnect: true
  });

  client.on('connect', () => {
    isConnected = true;
  });

  client.on('error', (err) => {
    isConnected = false;
    console.error('Redis connection error:', err.message);
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
}

/**
 * Execute Redis operation with retry and error handling
 */
async function withRedisRetry<T>(
  operation: (client: Redis) => Promise<T>,
  operationName: string
): Promise<T> {
  const maxRetries = REDIS_MAX_RETRIES;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(redis);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = REDIS_INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Check if Redis is available
 */
function isRedisAvailable(): boolean {
  return isConnected && redis?.status === 'ready';
}

// ============================================
// ACTION ENGINE
// ============================================

export enum ActionLevel {
  SAFE = 1,
  SEMI_SAFE = 2,
  RISKY = 3,
  FORBIDDEN = 4
}

export enum ActionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

interface Action {
  id: string;
  type: string;
  level: ActionLevel;
  status: ActionStatus;
  payload: Record<string, unknown>;
  userId?: string;
  createdAt: Date;
  approvedAt?: Date;
  executedAt?: Date;
}

interface ActionResult {
  success: boolean;
  actionId: string;
  result?: Record<string, unknown>;
  error?: string;
}

interface RedisErrorResult {
  success: false;
  actionId: string;
  error: string;
  retryAfter?: number;
}

// Rate limits per level
const RATE_LIMITS = {
  [ActionLevel.SAFE]: 1000,
  [ActionLevel.SEMI_SAFE]: 100,
  [ActionLevel.RISKY]: 10,
  [ActionLevel.FORBIDDEN]: 0
};

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate action ID format
 */
function isValidActionId(actionId: string): boolean {
  if (!actionId || typeof actionId !== 'string') {
    return false;
  }
  // Allow alphanumeric, hyphens, and underscores, 1-64 chars
  return /^[a-zA-Z0-9_-]{1,64}$/.test(actionId);
}

/**
 * Validate action type
 */
function isValidActionType(type: string): boolean {
  if (!type || typeof type !== 'string') {
    return false;
  }
  // Allow alphanumeric and underscores, 1-32 chars
  return /^[a-zA-Z0-9_]{1,32}$/.test(type);
}

/**
 * Validate action level
 */
function isValidActionLevel(level: number): boolean {
  return Object.values(ActionLevel).includes(level);
}

/**
 * Validate action payload (basic check)
 */
function isValidPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) {
    return true;
  }
  if (typeof payload !== 'object') {
    return false;
  }
  // Check payload size (limit to 100KB)
  const payloadStr = JSON.stringify(payload);
  return payloadStr.length <= 102400;
}

export class ActionEngine {
  // Expose redis for shutdown handling
  get redis(): Redis {
    return redis;
  }

  constructor() {
    redis = createRedisClient();
    redis.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err.message);
    });
  }

  /**
   * Execute action with safety checks
   */
  async execute(action: Omit<Action, 'status' | 'createdAt'>): Promise<ActionResult | RedisErrorResult> {
    // Input validation
    if (!isValidActionId(action.id)) {
      return { success: false, actionId: action.id || '', error: 'Invalid action ID format' };
    }
    if (!isValidActionType(action.type)) {
      return { success: false, actionId: action.id, error: 'Invalid action type format' };
    }
    if (!isValidActionLevel(action.level)) {
      return { success: false, actionId: action.id, error: 'Invalid action level' };
    }
    if (!isValidPayload(action.payload)) {
      return { success: false, actionId: action.id, error: 'Invalid or oversized action payload' };
    }

    // Check Redis availability
    if (!isRedisAvailable()) {
      return {
        success: false,
        actionId: action.id,
        error: 'Redis service unavailable',
        retryAfter: 5
      };
    }

    // Check rate limit
    const rateLimitCheck = await this.checkRateLimit(action.level);
    if (!rateLimitCheck.success) {
      return rateLimitCheck;
    }

    // Execute based on level
    if (action.level >= ActionLevel.RISKY) {
      // Queue for approval
      try {
        await withRedisRetry(
          (client) => client.lpush('action:approval:queue', JSON.stringify({
            ...action,
            status: ActionStatus.PENDING,
            createdAt: new Date()
          })),
          'Queue action for approval'
        );
        return { success: true, actionId: action.id };
      } catch (error) {
        return {
          success: false,
          actionId: action.id,
          error: error instanceof Error ? error.message : 'Failed to queue action',
          retryAfter: 5
        };
      }
    }

    // Execute safe actions
    return this.performAction({ ...action, status: ActionStatus.EXECUTING } as Action);
  }

  private async checkRateLimit(level: ActionLevel): Promise<ActionResult | RedisErrorResult> {
    if (!isRedisAvailable()) {
      return {
        success: false,
        actionId: '',
        error: 'Redis service unavailable',
        retryAfter: 5
      };
    }

    try {
      const limit = RATE_LIMITS[level];
      const key = `action:rate:${level}:${new Date().getHours()}`;

      const count = await withRedisRetry(
        (client) => client.get(key),
        'Check rate limit'
      );

      const currentCount = parseInt(count || '0');
      if (currentCount >= limit) {
        return {
          success: false,
          actionId: '',
          error: `Rate limit exceeded for level ${level} (${currentCount}/${limit})`
        };
      }

      // Increment counter
      await withRedisRetry(
        (client) => client.incr(key),
        'Increment rate limit counter'
      );

      return { success: true, actionId: '' };
    } catch (error) {
      return {
        success: false,
        actionId: '',
        error: error instanceof Error ? error.message : 'Rate limit check failed',
        retryAfter: 5
      };
    }
  }

  private async performAction(action: Action): Promise<ActionResult | RedisErrorResult> {
    try {
      // Simulate action execution
      await withRedisRetry(
        (client) => client.lpush(`action:history:${action.id}`, JSON.stringify({
          ...action,
          status: ActionStatus.EXECUTING
        })),
        'Record action execution'
      );

      return {
        success: true,
        actionId: action.id,
        result: { executed: true }
      };
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Action execution failed',
        retryAfter: 5
      };
    }
  }

  /**
   * Approve action by ID (fixes IDOR vulnerability)
   */
  async approve(actionId: string): Promise<ActionResult | RedisErrorResult> {
    // Input validation
    if (!isValidActionId(actionId)) {
      return { success: false, actionId, error: 'Invalid action ID format' };
    }

    // Check Redis availability
    if (!isRedisAvailable()) {
      return {
        success: false,
        actionId,
        error: 'Redis service unavailable',
        retryAfter: 5
      };
    }

    try {
      // Get all pending actions from queue
      const queueItems = await withRedisRetry(
        (client) => client.lrange('action:approval:queue', 0, -1),
        'Fetch approval queue'
      );

      let targetAction: Action | null = null;
      let targetIndex = -1;

      // Search for the specific action by ID
      for (let i = 0; i < queueItems.length; i++) {
        try {
          const parsed: Action = JSON.parse(queueItems[i]);
          if (parsed.id === actionId) {
            targetAction = parsed;
            targetIndex = i;
            break;
          }
        } catch {
          // Skip malformed entries
          continue;
        }
      }

      // Action not found in queue
      if (!targetAction || targetIndex === -1) {
        return {
          success: false,
          actionId,
          error: 'Action not found in approval queue or already processed'
        };
      }

      // Verify action is still pending
      if (targetAction.status !== ActionStatus.PENDING) {
        return {
          success: false,
          actionId,
          error: `Action is not pending (current status: ${targetAction.status})`
        };
      }

      // Remove the action from queue using LREM (remove first occurrence)
      await withRedisRetry(
        (client) => client.lrem('action:approval:queue', 1, queueItems[targetIndex]),
        'Remove action from queue'
      );

      // Execute the approved action
      const result = await this.performAction({
        ...targetAction,
        id: actionId,
        status: ActionStatus.APPROVED,
        approvedAt: new Date()
      });

      if (!result.success) {
        // Re-queue if execution failed (action wasn't actually approved)
        await withRedisRetry(
          (client) => client.lpush('action:approval:queue', JSON.stringify({
            ...targetAction,
            status: ActionStatus.PENDING
          })),
          'Re-queue failed action'
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        actionId,
        error: error instanceof Error ? error.message : 'Approval process failed',
        retryAfter: 5
      };
    }
  }

  /**
   * Reject action
   */
  async reject(actionId: string, reason: string): Promise<ActionResult | RedisErrorResult> {
    // Input validation
    if (!isValidActionId(actionId)) {
      return { success: false, actionId, error: 'Invalid action ID format' };
    }
    if (!reason || typeof reason !== 'string' || reason.length > 500) {
      return { success: false, actionId, error: 'Invalid rejection reason (must be 1-500 characters)' };
    }

    // Check Redis availability
    if (!isRedisAvailable()) {
      return {
        success: false,
        actionId,
        error: 'Redis service unavailable',
        retryAfter: 5
      };
    }

    try {
      // Get all pending actions
      const queueItems = await withRedisRetry(
        (client) => client.lrange('action:approval:queue', 0, -1),
        'Fetch approval queue for rejection'
      );

      let targetAction: Action | null = null;
      let targetIndex = -1;

      // Search for the specific action
      for (let i = 0; i < queueItems.length; i++) {
        try {
          const parsed: Action = JSON.parse(queueItems[i]);
          if (parsed.id === actionId) {
            targetAction = parsed;
            targetIndex = i;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!targetAction || targetIndex === -1) {
        return {
          success: false,
          actionId,
          error: 'Action not found in approval queue'
        };
      }

      // Remove from queue
      await withRedisRetry(
        (client) => client.lrem('action:approval:queue', 1, queueItems[targetIndex]),
        'Remove rejected action from queue'
      );

      // Record rejection
      await withRedisRetry(
        (client) => client.lpush('action:rejected', JSON.stringify({
          actionId,
          reason,
          rejectedAt: new Date()
        })),
        'Record rejection'
      );

      return {
        success: true,
        actionId,
        result: { rejected: true, reason }
      };
    } catch (error) {
      return {
        success: false,
        actionId,
        error: error instanceof Error ? error.message : 'Rejection failed',
        retryAfter: 5
      };
    }
  }

  /**
   * Get pending actions
   */
  async getPending(limit = 10): Promise<Action[] | RedisErrorResult> {
    // Input validation
    const validatedLimit = Math.min(Math.max(1, Math.floor(limit)), 100);

    if (!isRedisAvailable()) {
      return {
        success: false,
        actionId: '',
        error: 'Redis service unavailable',
        retryAfter: 5
      };
    }

    try {
      const actions = await withRedisRetry(
        (client) => client.lrange('action:approval:queue', 0, validatedLimit - 1),
        'Fetch pending actions'
      );

      return actions.map(a => {
        try {
          return JSON.parse(a) as Action;
        } catch {
          return null;
        }
      }).filter((a): a is Action => a !== null);
    } catch (error) {
      return {
        success: false,
        actionId: '',
        error: error instanceof Error ? error.message : 'Failed to fetch pending actions',
        retryAfter: 5
      };
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await withRedisRetry(
        (client) => client.ping(),
        'Health check'
      );
      return {
        healthy: true,
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (redis) {
      await redis.quit();
    }
  }
}

export const actionEngine = new ActionEngine();
