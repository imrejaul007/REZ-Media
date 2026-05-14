import Redis from 'ioredis';
export declare function getRedis(): Redis;
export declare function getRedisBullMQConnection(): {
    host: string;
    port: number;
    password: string | undefined;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
    keepAlive: number;
};
//# sourceMappingURL=redis.d.ts.map