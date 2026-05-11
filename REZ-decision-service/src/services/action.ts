import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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

// Rate limits per level
const RATE_LIMITS = {
  [ActionLevel.SAFE]: 1000,
  [ActionLevel.SEMI_SAFE]: 100,
  [ActionLevel.RISKY]: 10,
  [ActionLevel.FORBIDDEN]: 0
};

export class ActionEngine {
  /**
   * Execute action with safety checks
   */
  async execute(action: Omit<Action, 'status' | 'createdAt'>): Promise<ActionResult> {
    // Check rate limit
    if (!await this.checkRateLimit(action.level)) {
      return { success: false, actionId: action.id, error: 'Rate limit exceeded' };
    }

    // Execute based on level
    if (action.level >= ActionLevel.RISKY) {
      // Queue for approval
      await redis.lpush('action:approval:queue', JSON.stringify({
        ...action,
        status: ActionStatus.PENDING,
        createdAt: new Date()
      }));
      return { success: true, actionId: action.id };
    }

    // Execute safe actions
    return this.performAction(action);
  }

  private async checkRateLimit(level: ActionLevel): Promise<boolean> {
    const limit = RATE_LIMITS[level];
    const key = `action:rate:${level}:${new Date().getHours()}`;
    const count = parseInt(await redis.get(key) || '0');
    return count < limit;
  }

  private async performAction(action: Action): Promise<ActionResult> {
    // Execute based on action type
    try {
      // Simulate action execution
      await redis.lpush(`action:history:${action.id}`, JSON.stringify({
        ...action,
        status: ActionStatus.EXECUTING
      }));

      return {
        success: true,
        actionId: action.id,
        result: { executed: true }
      };
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Action failed'
      };
    }
  }

  /**
   * Approve action
   */
  async approve(actionId: string): Promise<ActionResult> {
    const action: Action = JSON.parse(
      await redis.lpop(`action:approval:queue`) || '{}'
    );

    if (!action.id) {
      return { success: false, actionId: actionId, error: 'Action not found' };
    }

    return this.performAction({ ...action, id: actionId });
  }

  /**
   * Reject action
   */
  async reject(actionId: string, reason: string): Promise<void> {
    await redis.lpush('action:rejected', JSON.stringify({ actionId, reason, rejectedAt: new Date() }));
  }

  /**
   * Get pending actions
   */
  async getPending(limit = 10): Promise<Action[]> {
    const actions = await redis.lrange('action:approval:queue', 0, limit - 1);
    return actions.map(a => JSON.parse(a));
  }
}

export const actionEngine = new ActionEngine();
