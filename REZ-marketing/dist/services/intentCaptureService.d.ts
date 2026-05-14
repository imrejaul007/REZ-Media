interface TrackParams {
    userId?: string;
    event: string;
    intentKey: string;
    properties?: Record<string, unknown>;
}
export declare function track(params: TrackParams): Promise<void>;
export {};
//# sourceMappingURL=intentCaptureService.d.ts.map