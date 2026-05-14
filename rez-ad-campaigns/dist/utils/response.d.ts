export declare const ErrorCodes: {
    readonly SRV_INTERNAL_ERROR: {
        readonly code: "SRV_001";
        readonly message: "Internal server error";
    };
    readonly RES_NOT_FOUND: {
        readonly code: "RES_001";
        readonly message: "Resource not found";
    };
};
export declare function success(data: unknown): {
    success: boolean;
    data: unknown;
};
export declare function err(code: string, details?: unknown): {
    success: boolean;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};
//# sourceMappingURL=response.d.ts.map