"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = void 0;
exports.success = success;
exports.err = err;
exports.ErrorCodes = {
    SRV_INTERNAL_ERROR: { code: 'SRV_001', message: 'Internal server error' },
    RES_NOT_FOUND: { code: 'RES_001', message: 'Resource not found' },
};
function success(data) {
    return { success: true, data };
}
function err(code, details) {
    const def = exports.ErrorCodes[code] || { code, message: 'An error occurred' };
    const errObj = typeof details === 'object' && details !== null ? details : {};
    return {
        success: false,
        error: { code: def.code, message: def.message, ...errObj }
    };
}
//# sourceMappingURL=response.js.map