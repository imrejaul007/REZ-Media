import { ActionFeedback } from '../types';
declare class FeedbackProcessor {
    private queue;
    private worker;
    private isProcessing;
    constructor();
    private initializeWorker;
    /**
     * Queue a single feedback item for processing
     */
    queueFeedback(feedback: ActionFeedback): Promise<void>;
    /**
     * Queue multiple feedback items as a batch
     */
    queueBatchFeedback(feedbacks: ActionFeedback[]): Promise<void>;
    /**
     * Process a single feedback job
     */
    private processFeedbackJob;
    /**
     * Store feedback in MongoDB
     */
    private storeFeedback;
    /**
     * Aggregate feedback patterns
     */
    private aggregatePattern;
    /**
     * Send feedback to ReZ Mind for model updates
     */
    private sendToMind;
    /**
     * Check for drift based on recent feedback
     */
    private checkDrift;
    /**
     * Get feedback history for an action
     */
    getActionHistory(actionId: string, limit?: number): Promise<ActionFeedback[]>;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<any>;
    /**
     * Stop the processor gracefully
     */
    shutdown(): Promise<void>;
}
export declare const feedbackProcessor: FeedbackProcessor;
export {};
//# sourceMappingURL=feedback-processor.d.ts.map