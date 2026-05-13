"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactIdSchema = exports.SyncTriggerSchema = exports.LinkContactSchema = exports.CreateDealSchema = exports.DealQuerySchema = exports.ContactQuerySchema = exports.PaginationSchema = exports.ObjectIdSchema = void 0;
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
const zod_1 = require("zod");
/**
 * Validate request body against a Zod schema
 */
function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
/**
 * Validate query parameters against a Zod schema
 */
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
/**
 * Validate route parameters against a Zod schema
 */
function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid route parameters',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
// ============================================
// Common Schemas
// ============================================
exports.ObjectIdSchema = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.string().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.ContactQuerySchema = exports.PaginationSchema.extend({
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    syncStatus: zod_1.z.enum(['synced', 'pending', 'conflict', 'error']).optional(),
    search: zod_1.z.string().optional(),
    linkedRezUserId: zod_1.z.string().optional(),
});
exports.DealQuerySchema = exports.PaginationSchema.extend({
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    stage: zod_1.z.string().optional(),
    minAmount: zod_1.z.coerce.number().optional(),
    maxAmount: zod_1.z.coerce.number().optional(),
});
exports.CreateDealSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().default('USD'),
    stage: zod_1.z.string().optional(),
    probability: zod_1.z.number().min(0).max(100).optional(),
    closeDate: zod_1.z.string().datetime().optional(),
    contactId: zod_1.z.string().optional(),
    companyName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    provider: zod_1.z.enum(['hubspot', 'zoho']).default('hubspot'),
});
exports.LinkContactSchema = zod_1.z.object({
    contactId: zod_1.z.string(),
    rezUserId: zod_1.z.string(),
});
exports.SyncTriggerSchema = zod_1.z.object({
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    entityType: zod_1.z.enum(['contact', 'deal']).optional(),
    force: zod_1.z.boolean().default(false),
});
exports.ContactIdSchema = zod_1.z.object({
    id: zod_1.z.string(),
});
exports.default = {
    validateBody,
    validateQuery,
    validateParams,
    ObjectIdSchema: exports.ObjectIdSchema,
    PaginationSchema: exports.PaginationSchema,
    ContactQuerySchema: exports.ContactQuerySchema,
    DealQuerySchema: exports.DealQuerySchema,
    CreateDealSchema: exports.CreateDealSchema,
    LinkContactSchema: exports.LinkContactSchema,
    SyncTriggerSchema: exports.SyncTriggerSchema,
    ContactIdSchema: exports.ContactIdSchema,
};
//# sourceMappingURL=validation.js.map