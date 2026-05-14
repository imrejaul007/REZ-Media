interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    version: string;
    uptime: number;
    checks: {
        mongodb: ComponentHealth;
        redis: ComponentHealth;
        rezMind: ComponentHealth;
        queue: ComponentHealth;
    };
}
interface ComponentHealth {
    status: 'up' | 'down' | 'unknown' | 'degraded';
    latency_ms?: number;
    message?: string;
}
export declare function checkHealth(): Promise<HealthStatus>;
export declare function isAlive(): boolean;
export declare function isReady(): Promise<boolean>;
export {};
//# sourceMappingURL=health.d.ts.map