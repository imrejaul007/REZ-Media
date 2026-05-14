export declare enum ActionLevel {
    SAFE = 1,
    SEMI_SAFE = 2,
    RISKY = 3,
    FORBIDDEN = 4
}
export declare enum ActionStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    EXECUTING = "EXECUTING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
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
export declare class ActionEngine {
    /**
     * Execute action with safety checks
     */
    execute(action: Omit<Action, 'status' | 'createdAt'>): Promise<ActionResult>;
    private checkRateLimit;
    private performAction;
    /**
     * Approve action
     */
    approve(actionId: string): Promise<ActionResult>;
    /**
     * Reject action
     */
    reject(actionId: string, reason: string): Promise<void>;
    /**
     * Get pending actions
     */
    getPending(limit?: number): Promise<Action[]>;
}
export declare const actionEngine: ActionEngine;
export {};
