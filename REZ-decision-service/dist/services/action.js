"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionEngine = exports.ActionEngine = exports.ActionStatus = exports.ActionLevel = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
// ============================================
// ACTION ENGINE
// ============================================
var ActionLevel;
(function (ActionLevel) {
    ActionLevel[ActionLevel["SAFE"] = 1] = "SAFE";
    ActionLevel[ActionLevel["SEMI_SAFE"] = 2] = "SEMI_SAFE";
    ActionLevel[ActionLevel["RISKY"] = 3] = "RISKY";
    ActionLevel[ActionLevel["FORBIDDEN"] = 4] = "FORBIDDEN";
})(ActionLevel || (exports.ActionLevel = ActionLevel = {}));
var ActionStatus;
(function (ActionStatus) {
    ActionStatus["PENDING"] = "PENDING";
    ActionStatus["APPROVED"] = "APPROVED";
    ActionStatus["REJECTED"] = "REJECTED";
    ActionStatus["EXECUTING"] = "EXECUTING";
    ActionStatus["COMPLETED"] = "COMPLETED";
    ActionStatus["FAILED"] = "FAILED";
})(ActionStatus || (exports.ActionStatus = ActionStatus = {}));
// Rate limits per level
const RATE_LIMITS = {
    [ActionLevel.SAFE]: 1000,
    [ActionLevel.SEMI_SAFE]: 100,
    [ActionLevel.RISKY]: 10,
    [ActionLevel.FORBIDDEN]: 0
};
class ActionEngine {
    /**
     * Execute action with safety checks
     */
    async execute(action) {
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
    async checkRateLimit(level) {
        const limit = RATE_LIMITS[level];
        const key = `action:rate:${level}:${new Date().getHours()}`;
        const count = parseInt(await redis.get(key) || '0');
        return count < limit;
    }
    async performAction(action) {
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
        }
        catch (error) {
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
    async approve(actionId) {
        const action = JSON.parse(await redis.lpop(`action:approval:queue`) || '{}');
        if (!action.id) {
            return { success: false, actionId: actionId, error: 'Action not found' };
        }
        return this.performAction({ ...action, id: actionId });
    }
    /**
     * Reject action
     */
    async reject(actionId, reason) {
        await redis.lpush('action:rejected', JSON.stringify({ actionId, reason, rejectedAt: new Date() }));
    }
    /**
     * Get pending actions
     */
    async getPending(limit = 10) {
        const actions = await redis.lrange('action:approval:queue', 0, limit - 1);
        return actions.map(a => JSON.parse(a));
    }
}
exports.ActionEngine = ActionEngine;
exports.actionEngine = new ActionEngine();
//# sourceMappingURL=action.js.map