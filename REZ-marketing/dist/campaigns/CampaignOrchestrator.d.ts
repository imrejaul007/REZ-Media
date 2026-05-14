export declare class CampaignOrchestrator {
    /**
     * Enqueue a campaign for dispatch.
     * Returns immediately — actual dispatch is async via campaignWorker.
     */
    dispatch(campaignId: string): Promise<{
        jobId: string;
    }>;
    /**
     * Execute campaign dispatch synchronously (called by campaignWorker).
     */
    execute(campaignId: string): Promise<{
        sent: number;
        failed: number;
        deduped: number;
    }>;
}
export declare const campaignOrchestrator: CampaignOrchestrator;
export default campaignOrchestrator;
//# sourceMappingURL=CampaignOrchestrator.d.ts.map