"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsChannel = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../config/logger");
class SMSChannel {
    get isConfigured() {
        return !!(process.env.MSG91_AUTH_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
    }
    normalizePhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10)
            return `91${cleaned}`;
        if (cleaned.startsWith('0'))
            return `91${cleaned.slice(1)}`;
        return cleaned;
    }
    async send(options) {
        if (!this.isConfigured)
            return { success: false, error: 'SMS not configured' };
        const phone = this.normalizePhone(options.to);
        if (process.env.MSG91_AUTH_KEY) {
            return this.sendViaMSG91(phone, options.message);
        }
        return this.sendViaTwilio(phone, options.message);
    }
    async sendViaMSG91(phone, message) {
        try {
            const response = await axios_1.default.post('https://api.msg91.com/api/sendhttp.php', null, {
                params: {
                    authkey: process.env.MSG91_AUTH_KEY,
                    mobiles: phone,
                    message,
                    sender: process.env.MSG91_SENDER_ID || 'REZAPP',
                    route: 4, // transactional
                    country: 91,
                },
                headers: { 'authkey': process.env.MSG91_AUTH_KEY },
                timeout: 10000,
            });
            return { success: true, messageId: response.data?.toString() };
        }
        catch (err) {
            logger_1.logger.warn('[SMS:MSG91] Send failed', { phone: `***${phone.slice(-4)}`, err: err.message });
            return { success: false, error: err.message };
        }
    }
    async sendViaTwilio(phone, message) {
        try {
            const { default: twilio } = await Promise.resolve().then(() => __importStar(require('twilio')));
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const result = await client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: `+${phone}`,
            });
            return { success: true, messageId: result.sid };
        }
        catch (err) {
            logger_1.logger.warn('[SMS:Twilio] Send failed', { phone: `***${phone.slice(-4)}`, err: err.message });
            return { success: false, error: err.message };
        }
    }
}
exports.smsChannel = new SMSChannel();
exports.default = exports.smsChannel;
//# sourceMappingURL=SMSChannel.js.map