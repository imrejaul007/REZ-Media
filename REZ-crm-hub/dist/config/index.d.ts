export declare const config: {
    port: number;
    nodeEnv: string;
    mongodb: {
        uri: string;
        options: {
            maxPoolSize: number;
            minPoolSize: number;
            serverSelectionTimeoutMS: number;
            socketTimeoutMS: number;
        };
    };
    redis: {
        url: string;
        keyPrefix: string;
    };
    internalServiceToken: string;
    hubspot: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        authUrl: string;
        tokenUrl: string;
        scopes: string[];
        apiBaseUrl: string;
    };
    zoho: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        authUrl: string;
        tokenUrl: string;
        apiBaseUrl: string;
        dataCenter: string;
    };
    sync: {
        intervalMinutes: number;
        batchSize: number;
        retryAttempts: number;
        retryDelayMs: number;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
};
export declare function validateConfig(): void;
export default config;
//# sourceMappingURL=index.d.ts.map