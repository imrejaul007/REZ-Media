/**
 * REZ Ads QR - RABTUL Integration
 * Uses centralized RABTUL connections module
 */

import { rabtul } from '../../../RABTUL-Technologies/REZ-qr-integrations/rabtulConnections';

// Export for use in service
export const auth = rabtul.auth;
export const payment = rabtul.payment;
export const wallet = rabtul.wallet;
export const notifications = rabtul.notifications;
export const agent = rabtul.agent;
export const care = rabtul.care;
export const mind = rabtul.mind;
export const intelligence = rabtul.intelligence;
export const delivery = rabtul.delivery;
export const merchant = rabtul.merchant;

// Default export
export default rabtul;
