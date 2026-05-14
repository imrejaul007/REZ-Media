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
        code: "SRV_001" | "RES_001";
        message: "Internal server error" | "Resource not found";
    };
};
//# sourceMappingURL=response.d.ts.map