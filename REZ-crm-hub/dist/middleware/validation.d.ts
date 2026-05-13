import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
/**
 * Validate request body against a Zod schema
 */
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validate query parameters against a Zod schema
 */
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validate route parameters against a Zod schema
 */
export declare function validateParams<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare const ObjectIdSchema: z.ZodString;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
}, {
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const ContactQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
    syncStatus: z.ZodOptional<z.ZodEnum<["synced", "pending", "conflict", "error"]>>;
    search: z.ZodOptional<z.ZodString>;
    linkedRezUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    provider?: "hubspot" | "zoho" | undefined;
    syncStatus?: "pending" | "synced" | "conflict" | "error" | undefined;
    linkedRezUserId?: string | undefined;
    search?: string | undefined;
}, {
    provider?: "hubspot" | "zoho" | undefined;
    syncStatus?: "pending" | "synced" | "conflict" | "error" | undefined;
    linkedRezUserId?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const DealQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
    stage: z.ZodOptional<z.ZodString>;
    minAmount: z.ZodOptional<z.ZodNumber>;
    maxAmount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    provider?: "hubspot" | "zoho" | undefined;
    stage?: string | undefined;
    minAmount?: number | undefined;
    maxAmount?: number | undefined;
}, {
    provider?: "hubspot" | "zoho" | undefined;
    stage?: string | undefined;
    minAmount?: number | undefined;
    maxAmount?: number | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const CreateDealSchema: z.ZodObject<{
    title: z.ZodString;
    amount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    stage: z.ZodOptional<z.ZodString>;
    probability: z.ZodOptional<z.ZodNumber>;
    closeDate: z.ZodOptional<z.ZodString>;
    contactId: z.ZodOptional<z.ZodString>;
    companyName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    provider: z.ZodDefault<z.ZodEnum<["hubspot", "zoho"]>>;
}, "strip", z.ZodTypeAny, {
    provider: "hubspot" | "zoho";
    title: string;
    currency: string;
    amount?: number | undefined;
    stage?: string | undefined;
    probability?: number | undefined;
    closeDate?: string | undefined;
    contactId?: string | undefined;
    companyName?: string | undefined;
    description?: string | undefined;
}, {
    title: string;
    provider?: "hubspot" | "zoho" | undefined;
    amount?: number | undefined;
    currency?: string | undefined;
    stage?: string | undefined;
    probability?: number | undefined;
    closeDate?: string | undefined;
    contactId?: string | undefined;
    companyName?: string | undefined;
    description?: string | undefined;
}>;
export declare const LinkContactSchema: z.ZodObject<{
    contactId: z.ZodString;
    rezUserId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contactId: string;
    rezUserId: string;
}, {
    contactId: string;
    rezUserId: string;
}>;
export declare const SyncTriggerSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
    entityType: z.ZodOptional<z.ZodEnum<["contact", "deal"]>>;
    force: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    force: boolean;
    provider?: "hubspot" | "zoho" | undefined;
    entityType?: "contact" | "deal" | undefined;
}, {
    provider?: "hubspot" | "zoho" | undefined;
    entityType?: "contact" | "deal" | undefined;
    force?: boolean | undefined;
}>;
export declare const ContactIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
declare const _default: {
    validateBody: typeof validateBody;
    validateQuery: typeof validateQuery;
    validateParams: typeof validateParams;
    ObjectIdSchema: z.ZodString;
    PaginationSchema: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sortBy: z.ZodDefault<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: string;
        sortOrder: "asc" | "desc";
    }, {
        limit?: number | undefined;
        page?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    ContactQuerySchema: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sortBy: z.ZodDefault<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    } & {
        provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
        syncStatus: z.ZodOptional<z.ZodEnum<["synced", "pending", "conflict", "error"]>>;
        search: z.ZodOptional<z.ZodString>;
        linkedRezUserId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: string;
        sortOrder: "asc" | "desc";
        provider?: "hubspot" | "zoho" | undefined;
        syncStatus?: "pending" | "synced" | "conflict" | "error" | undefined;
        linkedRezUserId?: string | undefined;
        search?: string | undefined;
    }, {
        provider?: "hubspot" | "zoho" | undefined;
        syncStatus?: "pending" | "synced" | "conflict" | "error" | undefined;
        linkedRezUserId?: string | undefined;
        search?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    DealQuerySchema: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sortBy: z.ZodDefault<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    } & {
        provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
        stage: z.ZodOptional<z.ZodString>;
        minAmount: z.ZodOptional<z.ZodNumber>;
        maxAmount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sortBy: string;
        sortOrder: "asc" | "desc";
        provider?: "hubspot" | "zoho" | undefined;
        stage?: string | undefined;
        minAmount?: number | undefined;
        maxAmount?: number | undefined;
    }, {
        provider?: "hubspot" | "zoho" | undefined;
        stage?: string | undefined;
        minAmount?: number | undefined;
        maxAmount?: number | undefined;
        limit?: number | undefined;
        page?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    CreateDealSchema: z.ZodObject<{
        title: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodDefault<z.ZodString>;
        stage: z.ZodOptional<z.ZodString>;
        probability: z.ZodOptional<z.ZodNumber>;
        closeDate: z.ZodOptional<z.ZodString>;
        contactId: z.ZodOptional<z.ZodString>;
        companyName: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        provider: z.ZodDefault<z.ZodEnum<["hubspot", "zoho"]>>;
    }, "strip", z.ZodTypeAny, {
        provider: "hubspot" | "zoho";
        title: string;
        currency: string;
        amount?: number | undefined;
        stage?: string | undefined;
        probability?: number | undefined;
        closeDate?: string | undefined;
        contactId?: string | undefined;
        companyName?: string | undefined;
        description?: string | undefined;
    }, {
        title: string;
        provider?: "hubspot" | "zoho" | undefined;
        amount?: number | undefined;
        currency?: string | undefined;
        stage?: string | undefined;
        probability?: number | undefined;
        closeDate?: string | undefined;
        contactId?: string | undefined;
        companyName?: string | undefined;
        description?: string | undefined;
    }>;
    LinkContactSchema: z.ZodObject<{
        contactId: z.ZodString;
        rezUserId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        contactId: string;
        rezUserId: string;
    }, {
        contactId: string;
        rezUserId: string;
    }>;
    SyncTriggerSchema: z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<["hubspot", "zoho"]>>;
        entityType: z.ZodOptional<z.ZodEnum<["contact", "deal"]>>;
        force: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        force: boolean;
        provider?: "hubspot" | "zoho" | undefined;
        entityType?: "contact" | "deal" | undefined;
    }, {
        provider?: "hubspot" | "zoho" | undefined;
        entityType?: "contact" | "deal" | undefined;
        force?: boolean | undefined;
    }>;
    ContactIdSchema: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
};
export default _default;
//# sourceMappingURL=validation.d.ts.map