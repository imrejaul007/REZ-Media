"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMConnectionSchema = exports.SyncHistorySchema = exports.FieldMappingSchema = exports.CRMDealSchema = exports.CRMContactSchema = exports.OAuthTokensSchema = exports.EmailSchema = exports.PhoneSchema = exports.AddressSchema = exports.DealStage = exports.ContactSyncStatus = exports.SyncDirection = exports.SyncStatus = exports.CRMProvider = void 0;
const zod_1 = require("zod");
// ============================================
// Enums
// ============================================
var CRMProvider;
(function (CRMProvider) {
    CRMProvider["HUBSPOT"] = "hubspot";
    CRMProvider["ZOHO"] = "zoho";
})(CRMProvider || (exports.CRMProvider = CRMProvider = {}));
var SyncStatus;
(function (SyncStatus) {
    SyncStatus["PENDING"] = "pending";
    SyncStatus["IN_PROGRESS"] = "in_progress";
    SyncStatus["COMPLETED"] = "completed";
    SyncStatus["FAILED"] = "failed";
})(SyncStatus || (exports.SyncStatus = SyncStatus = {}));
var SyncDirection;
(function (SyncDirection) {
    SyncDirection["IMPORT"] = "import";
    SyncDirection["EXPORT"] = "export";
    SyncDirection["BIDIRECTIONAL"] = "bidirectional";
})(SyncDirection || (exports.SyncDirection = SyncDirection = {}));
var ContactSyncStatus;
(function (ContactSyncStatus) {
    ContactSyncStatus["SYNCED"] = "synced";
    ContactSyncStatus["PENDING"] = "pending";
    ContactSyncStatus["CONFLICT"] = "conflict";
    ContactSyncStatus["ERROR"] = "error";
})(ContactSyncStatus || (exports.ContactSyncStatus = ContactSyncStatus = {}));
var DealStage;
(function (DealStage) {
    DealStage["APPOINTMENT_SCHEDULED"] = "appointment_scheduled";
    DealStage["QUALIFIED_TO_BUY"] = "qualified_to_buy";
    DealStage["PRESENTATION_SCHEDULED"] = "presentation_scheduled";
    DealStage["DECISION_MAKER_BOUGHT_IN"] = "decision_maker_bought_in";
    DealStage["CONTRACT_SENT"] = "contract_sent";
    DealStage["CLOSED_WON"] = "closed_won";
    DealStage["CLOSED_LOST"] = "closed_lost";
})(DealStage || (exports.DealStage = DealStage = {}));
// ============================================
// Zod Schemas
// ============================================
exports.AddressSchema = zod_1.z.object({
    street: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
exports.PhoneSchema = zod_1.z.object({
    type: zod_1.z.enum(['work', 'home', 'mobile', 'other']).optional(),
    number: zod_1.z.string(),
    isPrimary: zod_1.z.boolean().default(false),
});
exports.EmailSchema = zod_1.z.object({
    type: zod_1.z.enum(['work', 'home', 'other']).optional(),
    address: zod_1.z.string().email(),
    isPrimary: zod_1.z.boolean().default(false),
});
// ============================================
// OAuth Tokens
// ============================================
exports.OAuthTokensSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    refreshToken: zod_1.z.string().optional(),
    expiresAt: zod_1.z.number(),
    tokenType: zod_1.z.string().default('Bearer'),
    scope: zod_1.z.string().optional(),
});
// ============================================
// Unified Contact Model
// ============================================
exports.CRMContactSchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    externalId: zod_1.z.string(),
    provider: zod_1.z.nativeEnum(CRMProvider),
    email: zod_1.z.string().email().optional(),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    phone: exports.PhoneSchema.optional(),
    phones: zod_1.z.array(exports.PhoneSchema).default([]),
    emails: zod_1.z.array(exports.EmailSchema).default([]),
    company: zod_1.z.string().optional(),
    jobTitle: zod_1.z.string().optional(),
    address: exports.AddressSchema.optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    notes: zod_1.z.string().optional(),
    lifecycleStage: zod_1.z.string().optional(),
    leadSource: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.unknown()).default({}),
    syncStatus: zod_1.z.nativeEnum(ContactSyncStatus).default(ContactSyncStatus.PENDING),
    lastSyncedAt: zod_1.z.date().optional(),
    syncError: zod_1.z.string().optional(),
    linkedRezUserId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).default({}),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
// ============================================
// Unified Deal Model
// ============================================
exports.CRMDealSchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    externalId: zod_1.z.string(),
    provider: zod_1.z.nativeEnum(CRMProvider),
    title: zod_1.z.string().min(1),
    amount: zod_1.z.number().optional(),
    currency: zod_1.z.string().default('USD'),
    stage: zod_1.z.string(),
    probability: zod_1.z.number().min(0).max(100).optional(),
    closeDate: zod_1.z.date().optional(),
    contactId: zod_1.z.string().optional(),
    companyName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.unknown()).default({}),
    metadata: zod_1.z.record(zod_1.z.unknown()).default({}),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
// ============================================
// Field Mapping Configuration
// ============================================
exports.FieldMappingSchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    provider: zod_1.z.nativeEnum(CRMProvider),
    entityType: zod_1.z.enum(['contact', 'deal']),
    crmToUnified: zod_1.z.record(zod_1.z.string()),
    unifiedToCrm: zod_1.z.record(zod_1.z.string()),
    isActive: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
// ============================================
// Sync History
// ============================================
exports.SyncHistorySchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    provider: zod_1.z.nativeEnum(CRMProvider),
    entityType: zod_1.z.enum(['contact', 'deal']),
    direction: zod_1.z.nativeEnum(SyncDirection),
    status: zod_1.z.nativeEnum(SyncStatus),
    startedAt: zod_1.z.date(),
    completedAt: zod_1.z.date().optional(),
    totalRecords: zod_1.z.number().default(0),
    successCount: zod_1.z.number().default(0),
    errorCount: zod_1.z.number().default(0),
    errors: zod_1.z.array(zod_1.z.object({
        externalId: zod_1.z.string(),
        error: zod_1.z.string(),
        timestamp: zod_1.z.date(),
    })).default([]),
    details: zod_1.z.record(zod_1.z.unknown()).default({}),
});
// ============================================
// CRM Connection
// ============================================
exports.CRMConnectionSchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    provider: zod_1.z.nativeEnum(CRMProvider),
    isConnected: zod_1.z.boolean().default(false),
    tokens: exports.OAuthTokensSchema.optional(),
    accountInfo: zod_1.z.record(zod_1.z.unknown()).optional(),
    lastSyncAt: zod_1.z.date().optional(),
    syncEnabled: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
//# sourceMappingURL=index.js.map