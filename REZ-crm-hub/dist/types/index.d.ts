import { z } from 'zod';
export declare enum CRMProvider {
    HUBSPOT = "hubspot",
    ZOHO = "zoho"
}
export declare enum SyncStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum SyncDirection {
    IMPORT = "import",
    EXPORT = "export",
    BIDIRECTIONAL = "bidirectional"
}
export declare enum ContactSyncStatus {
    SYNCED = "synced",
    PENDING = "pending",
    CONFLICT = "conflict",
    ERROR = "error"
}
export declare enum DealStage {
    APPOINTMENT_SCHEDULED = "appointment_scheduled",
    QUALIFIED_TO_BUY = "qualified_to_buy",
    PRESENTATION_SCHEDULED = "presentation_scheduled",
    DECISION_MAKER_BOUGHT_IN = "decision_maker_bought_in",
    CONTRACT_SENT = "contract_sent",
    CLOSED_WON = "closed_won",
    CLOSED_LOST = "closed_lost"
}
export interface Address {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}
export interface Phone {
    type?: 'work' | 'home' | 'mobile' | 'other';
    number: string;
    isPrimary: boolean;
}
export interface Email {
    type?: 'work' | 'home' | 'other';
    address: string;
    isPrimary: boolean;
}
export declare const AddressSchema: z.ZodObject<{
    street: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    street?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
}, {
    street?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
}>;
export declare const PhoneSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["work", "home", "mobile", "other"]>>;
    number: z.ZodString;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    number: string;
    isPrimary: boolean;
    type?: "work" | "home" | "mobile" | "other" | undefined;
}, {
    number: string;
    type?: "work" | "home" | "mobile" | "other" | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const EmailSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["work", "home", "other"]>>;
    address: z.ZodString;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isPrimary: boolean;
    address: string;
    type?: "work" | "home" | "other" | undefined;
}, {
    address: string;
    type?: "work" | "home" | "other" | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const OAuthTokensSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodNumber;
    tokenType: z.ZodDefault<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    expiresAt: number;
    tokenType: string;
    refreshToken?: string | undefined;
    scope?: string | undefined;
}, {
    accessToken: string;
    expiresAt: number;
    refreshToken?: string | undefined;
    tokenType?: string | undefined;
    scope?: string | undefined;
}>;
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
export declare const CRMContactSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    externalId: z.ZodString;
    provider: z.ZodNativeEnum<typeof CRMProvider>;
    email: z.ZodOptional<z.ZodString>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<["work", "home", "mobile", "other"]>>;
        number: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        number: string;
        isPrimary: boolean;
        type?: "work" | "home" | "mobile" | "other" | undefined;
    }, {
        number: string;
        type?: "work" | "home" | "mobile" | "other" | undefined;
        isPrimary?: boolean | undefined;
    }>>;
    phones: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<["work", "home", "mobile", "other"]>>;
        number: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        number: string;
        isPrimary: boolean;
        type?: "work" | "home" | "mobile" | "other" | undefined;
    }, {
        number: string;
        type?: "work" | "home" | "mobile" | "other" | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    emails: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<["work", "home", "other"]>>;
        address: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        isPrimary: boolean;
        address: string;
        type?: "work" | "home" | "other" | undefined;
    }, {
        address: string;
        type?: "work" | "home" | "other" | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    company: z.ZodOptional<z.ZodString>;
    jobTitle: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        postalCode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
    }>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
    lifecycleStage: z.ZodOptional<z.ZodString>;
    leadSource: z.ZodOptional<z.ZodString>;
    customFields: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    syncStatus: z.ZodDefault<z.ZodNativeEnum<typeof ContactSyncStatus>>;
    lastSyncedAt: z.ZodOptional<z.ZodDate>;
    syncError: z.ZodOptional<z.ZodString>;
    linkedRezUserId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    externalId: string;
    provider: CRMProvider;
    firstName: string;
    lastName: string;
    phones: {
        number: string;
        isPrimary: boolean;
        type?: "work" | "home" | "mobile" | "other" | undefined;
    }[];
    emails: {
        isPrimary: boolean;
        address: string;
        type?: "work" | "home" | "other" | undefined;
    }[];
    tags: string[];
    customFields: Record<string, unknown>;
    syncStatus: ContactSyncStatus;
    metadata: Record<string, unknown>;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    _id?: string | undefined;
    email?: string | undefined;
    phone?: {
        number: string;
        isPrimary: boolean;
        type?: "work" | "home" | "mobile" | "other" | undefined;
    } | undefined;
    company?: string | undefined;
    jobTitle?: string | undefined;
    notes?: string | undefined;
    lifecycleStage?: string | undefined;
    leadSource?: string | undefined;
    lastSyncedAt?: Date | undefined;
    syncError?: string | undefined;
    linkedRezUserId?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}, {
    externalId: string;
    provider: CRMProvider;
    firstName: string;
    lastName: string;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    _id?: string | undefined;
    email?: string | undefined;
    phone?: {
        number: string;
        type?: "work" | "home" | "mobile" | "other" | undefined;
        isPrimary?: boolean | undefined;
    } | undefined;
    phones?: {
        number: string;
        type?: "work" | "home" | "mobile" | "other" | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    emails?: {
        address: string;
        type?: "work" | "home" | "other" | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    company?: string | undefined;
    jobTitle?: string | undefined;
    tags?: string[] | undefined;
    notes?: string | undefined;
    lifecycleStage?: string | undefined;
    leadSource?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    syncStatus?: ContactSyncStatus | undefined;
    lastSyncedAt?: Date | undefined;
    syncError?: string | undefined;
    linkedRezUserId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}>;
export type CRMContact = z.infer<typeof CRMContactSchema>;
export declare const CRMDealSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    externalId: z.ZodString;
    provider: z.ZodNativeEnum<typeof CRMProvider>;
    title: z.ZodString;
    amount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    stage: z.ZodString;
    probability: z.ZodOptional<z.ZodNumber>;
    closeDate: z.ZodOptional<z.ZodDate>;
    contactId: z.ZodOptional<z.ZodString>;
    companyName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    customFields: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    externalId: string;
    provider: CRMProvider;
    customFields: Record<string, unknown>;
    metadata: Record<string, unknown>;
    title: string;
    currency: string;
    stage: string;
    _id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    amount?: number | undefined;
    probability?: number | undefined;
    closeDate?: Date | undefined;
    contactId?: string | undefined;
    companyName?: string | undefined;
    description?: string | undefined;
}, {
    externalId: string;
    provider: CRMProvider;
    title: string;
    stage: string;
    _id?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    amount?: number | undefined;
    currency?: string | undefined;
    probability?: number | undefined;
    closeDate?: Date | undefined;
    contactId?: string | undefined;
    companyName?: string | undefined;
    description?: string | undefined;
}>;
export type CRMDeal = z.infer<typeof CRMDealSchema>;
export declare const FieldMappingSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    provider: z.ZodNativeEnum<typeof CRMProvider>;
    entityType: z.ZodEnum<["contact", "deal"]>;
    crmToUnified: z.ZodRecord<z.ZodString, z.ZodString>;
    unifiedToCrm: z.ZodRecord<z.ZodString, z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    provider: CRMProvider;
    entityType: "contact" | "deal";
    crmToUnified: Record<string, string>;
    unifiedToCrm: Record<string, string>;
    isActive: boolean;
    _id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
}, {
    provider: CRMProvider;
    entityType: "contact" | "deal";
    crmToUnified: Record<string, string>;
    unifiedToCrm: Record<string, string>;
    _id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    isActive?: boolean | undefined;
}>;
export type FieldMapping = z.infer<typeof FieldMappingSchema>;
export declare const SyncHistorySchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    provider: z.ZodNativeEnum<typeof CRMProvider>;
    entityType: z.ZodEnum<["contact", "deal"]>;
    direction: z.ZodNativeEnum<typeof SyncDirection>;
    status: z.ZodNativeEnum<typeof SyncStatus>;
    startedAt: z.ZodDate;
    completedAt: z.ZodOptional<z.ZodDate>;
    totalRecords: z.ZodDefault<z.ZodNumber>;
    successCount: z.ZodDefault<z.ZodNumber>;
    errorCount: z.ZodDefault<z.ZodNumber>;
    errors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        externalId: z.ZodString;
        error: z.ZodString;
        timestamp: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        error: string;
        externalId: string;
        timestamp: Date;
    }, {
        error: string;
        externalId: string;
        timestamp: Date;
    }>, "many">>;
    details: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: SyncStatus;
    provider: CRMProvider;
    entityType: "contact" | "deal";
    direction: SyncDirection;
    startedAt: Date;
    totalRecords: number;
    successCount: number;
    errorCount: number;
    errors: {
        error: string;
        externalId: string;
        timestamp: Date;
    }[];
    details: Record<string, unknown>;
    _id?: string | undefined;
    completedAt?: Date | undefined;
}, {
    status: SyncStatus;
    provider: CRMProvider;
    entityType: "contact" | "deal";
    direction: SyncDirection;
    startedAt: Date;
    _id?: string | undefined;
    completedAt?: Date | undefined;
    totalRecords?: number | undefined;
    successCount?: number | undefined;
    errorCount?: number | undefined;
    errors?: {
        error: string;
        externalId: string;
        timestamp: Date;
    }[] | undefined;
    details?: Record<string, unknown> | undefined;
}>;
export type SyncHistory = z.infer<typeof SyncHistorySchema>;
export declare const CRMConnectionSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    provider: z.ZodNativeEnum<typeof CRMProvider>;
    isConnected: z.ZodDefault<z.ZodBoolean>;
    tokens: z.ZodOptional<z.ZodObject<{
        accessToken: z.ZodString;
        refreshToken: z.ZodOptional<z.ZodString>;
        expiresAt: z.ZodNumber;
        tokenType: z.ZodDefault<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        accessToken: string;
        expiresAt: number;
        tokenType: string;
        refreshToken?: string | undefined;
        scope?: string | undefined;
    }, {
        accessToken: string;
        expiresAt: number;
        refreshToken?: string | undefined;
        tokenType?: string | undefined;
        scope?: string | undefined;
    }>>;
    accountInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    lastSyncAt: z.ZodOptional<z.ZodDate>;
    syncEnabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    provider: CRMProvider;
    isConnected: boolean;
    syncEnabled: boolean;
    _id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    tokens?: {
        accessToken: string;
        expiresAt: number;
        tokenType: string;
        refreshToken?: string | undefined;
        scope?: string | undefined;
    } | undefined;
    accountInfo?: Record<string, unknown> | undefined;
    lastSyncAt?: Date | undefined;
}, {
    provider: CRMProvider;
    _id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    isConnected?: boolean | undefined;
    tokens?: {
        accessToken: string;
        expiresAt: number;
        refreshToken?: string | undefined;
        tokenType?: string | undefined;
        scope?: string | undefined;
    } | undefined;
    accountInfo?: Record<string, unknown> | undefined;
    lastSyncAt?: Date | undefined;
    syncEnabled?: boolean | undefined;
}>;
export type CRMConnection = z.infer<typeof CRMConnectionSchema>;
export interface CreateDealRequest {
    title: string;
    amount?: number;
    currency?: string;
    stage?: string;
    probability?: number;
    closeDate?: string;
    contactId?: string;
    companyName?: string;
    description?: string;
    provider?: CRMProvider;
}
export interface SyncTriggerRequest {
    provider?: CRMProvider;
    entityType?: 'contact' | 'deal';
    force?: boolean;
}
export interface LinkContactRequest {
    contactId: string;
    rezUserId: string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface ContactQueryParams extends PaginationParams {
    provider?: CRMProvider;
    syncStatus?: string;
    search?: string;
    linkedRezUserId?: string;
}
export interface DealQueryParams extends PaginationParams {
    provider?: CRMProvider;
    stage?: string;
    minAmount?: number;
    maxAmount?: number;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface SyncStatusResponse {
    hubspot: {
        connected: boolean;
        lastSync: string | null;
        pendingContacts: number;
        pendingDeals: number;
    };
    zoho: {
        connected: boolean;
        lastSync: string | null;
        pendingContacts: number;
        pendingDeals: number;
    };
    activeSync: SyncHistory | null;
}
//# sourceMappingURL=index.d.ts.map