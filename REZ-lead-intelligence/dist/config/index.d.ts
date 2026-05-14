/**
 * Lead Intelligence Service Configuration
 */
export declare const config: {
    port: number;
    healthPort: number;
    nodeEnv: string;
    mongodb: {
        uri: string;
        db: string;
    };
    redis: {
        url: string;
        password: string | undefined;
    };
    services: {
        marketing: string;
        notification: string;
        profile: string;
        order: string;
        intent: string;
        mind: string;
    };
    thresholds: {
        hot: number;
        warm: number;
    };
    scoring: {
        weights: {
            recentSearches: number;
            abandonedCarts: number;
            viewedProducts: number;
            lastActiveHours: number;
            intentStrength: number;
            purchaseProbability: number;
        };
    };
    reEngagement: {
        maxAttempts: number;
        minIntervalHours: number;
        cartExpiryHours: number;
        searchExpiryHours: number;
        hotLeadsIntervalHours: number;
        warmLeadsIntervalHours: number;
        coldLeadsIntervalHours: number;
    };
    channelWeights: {
        whatsapp: {
            engagementRate: number;
            conversionRate: number;
            urgency: number;
        };
        push: {
            engagementRate: number;
            conversionRate: number;
            urgency: number;
        };
        sms: {
            engagementRate: number;
            conversionRate: number;
            urgency: number;
        };
        email: {
            engagementRate: number;
            conversionRate: number;
            urgency: number;
        };
    };
    cache: {
        leadScoreTTL: number;
        userActivityTTL: number;
    };
    ml: {
        modelServer: string;
        featureStore: string;
    };
    logging: {
        level: string;
    };
    cors: {
        origin: string;
        methods: string[];
        allowedHeaders: string[];
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map