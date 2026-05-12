/**
 * REZ Platform App Integrations
 *
 * This module defines how each REZ application integrates with
 * the WhatsApp Business API through the communications platform.
 *
 * Each integration maps specific app workflows to WhatsApp templates
 * and handles the business logic for when to send notifications.
 */

import { getTemplate, fillTemplate, WhatsAppTemplateType } from '../whatsapp/templates';
import { logger } from '../utils/logger';

// =============================================================================
// Types & Interfaces
// =============================================================================

export type AppType =
  | 'adBazaar'
  | 'creators'
  | 'doohMobile'
  | 'hotelOTA'
  | 'rendez'
  | 'foodDelivery';

export interface AppIntegration {
  app: AppType;
  name: string;
  description: string;
  whatsappNotifications: NotificationConfig[];
  eventHandlers: EventHandlerMap;
}

export interface NotificationConfig {
  event: string;
  templateType: WhatsAppTemplateType;
  description: string;
  delaySeconds?: number;
  conditions?: NotificationCondition[];
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains';
  value: string | number | boolean;
}

export interface EventHandlerMap {
  [eventName: string]: (context: EventContext) => Promise<SendResult>;
}

export interface EventContext {
  app: AppType;
  event: string;
  payload: Record<string, unknown>;
  userId?: string;
  phone?: string;
  correlationId: string;
}

export interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// =============================================================================
// Integration Configurations
// =============================================================================

/**
 * AdBazaar WhatsApp Integration
 * Handles notifications for ad campaigns, approvals, and performance updates.
 */
export const adBazaarIntegration: AppIntegration = {
  app: 'adBazaar',
  name: 'AdBazaar',
  description: 'Advertising platform for businesses to create and manage ad campaigns',

  whatsappNotifications: [
    {
      event: 'campaign_approved',
      templateType: 'campaign_promotion',
      description: 'Notify advertiser when their campaign is approved',
      conditions: [
        { field: 'notifyUser', operator: 'equals', value: true },
      ],
    },
    {
      event: 'campaign_rejected',
      templateType: 'campaign_promotion',
      description: 'Notify advertiser when their campaign needs revision',
    },
    {
      event: 'ad_expiring',
      templateType: 'delivery_update',
      description: 'Alert advertiser before their ad budget expires',
      delaySeconds: 86400, // 24 hours before expiry
    },
    {
      event: 'performance_milestone',
      templateType: 'campaign_promotion',
      description: 'Notify when campaign reaches performance milestones',
      conditions: [
        { field: 'milestoneType', operator: 'contains', value: '1000_impressions' },
      ],
    },
    {
      event: 'payment_received',
      templateType: 'order_confirmation',
      description: 'Confirm payment for ad campaign',
    },
  ],

  eventHandlers: {
    async campaign_approved(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const campaignName = payload.campaignName as string;
      const budget = payload.budget as string;
      const startDate = payload.startDate as string;

      const template = getTemplate('campaign_promotion');
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const result = await sendWhatsAppMessage(phone!, {
        headline: 'Campaign Approved!',
        promoDetails: `Your campaign "${campaignName}" is now live!\n\nBudget: ${budget}\nStart Date: ${startDate}\n\nYour ads will start appearing to your target audience.`,
        cta: 'View Campaign Dashboard',
        promoCode: 'TRACKNOW',
        validityPeriod: 'immediately',
      }, correlationId);

      return result;
    },

    async campaign_rejected(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const campaignName = payload.campaignName as string;
      const rejectionReason = payload.rejectionReason as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Campaign Update Required',
        promoDetails: `Your campaign "${campaignName}" needs some adjustments:\n\n${rejectionReason}\n\nPlease update your campaign to get it approved.`,
        cta: 'Edit Campaign',
        promoCode: '',
        validityPeriod: 'as soon as possible',
      }, correlationId);
    },

    async ad_expiring(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const campaignName = payload.campaignName as string;
      const remainingBudget = payload.remainingBudget as string;
      const expiryDate = payload.expiryDate as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Ad Budget Expiring Soon',
        promoDetails: `Your campaign "${campaignName}" budget of ${remainingBudget} will expire on ${expiryDate}.\n\nTop up now to keep your ads running!`,
        cta: 'Add Budget',
        promoCode: 'EXTEND10',
        validityPeriod: 'before expiry',
      }, correlationId);
    },

    async performance_milestone(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const campaignName = payload.campaignName as string;
      const milestoneType = payload.milestoneType as string;
      const currentMetrics = payload.currentMetrics as string;

      return await sendWhatsAppMessage(phone!, {
        headline: `${milestoneType} Reached! 🎉`,
        promoDetails: `Congratulations! Your campaign "${campaignName}" has reached ${milestoneType}.\n\nCurrent Stats: ${currentMetrics}`,
        cta: 'View Full Analytics',
        promoCode: '',
        validityPeriod: 'now',
      }, correlationId);
    },

    async payment_received(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const amount = payload.amount as string;
      const campaignName = payload.campaignName as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Payment Confirmed',
        promoDetails: `Your payment of ${amount} for "${campaignName}" has been received.\n\nYour campaign will be activated shortly.`,
        cta: 'View Receipt',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },
  },
};

/**
 * Creators WhatsApp Integration
 * Handles notifications for content creators about campaign opportunities and earnings.
 */
export const creatorsIntegration: AppIntegration = {
  app: 'creators',
  name: 'ReZ Creators',
  description: 'Platform connecting brands with content creators for collaborations',

  whatsappNotifications: [
    {
      event: 'campaign_opportunity',
      templateType: 'campaign_promotion',
      description: 'Notify creators of new campaign opportunities matching their profile',
      conditions: [
        { field: 'budgetRange', operator: 'greaterThan', value: 100 },
      ],
    },
    {
      event: 'campaign_assignment',
      templateType: 'order_confirmation',
      description: 'Confirm when a creator is selected for a campaign',
    },
    {
      event: 'payment_released',
      templateType: 'order_confirmation',
      description: 'Notify creators when payment is released for completed work',
    },
    {
      event: 'deadline_reminder',
      templateType: 'appointment_reminder',
      description: 'Remind creators of content submission deadlines',
      delaySeconds: 86400, // 24 hours before deadline
    },
    {
      event: 'performance_bonus',
      templateType: 'win_back',
      description: 'Notify creators of bonus earnings based on performance',
    },
  ],

  eventHandlers: {
    async campaign_opportunity(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const brandName = payload.brandName as string;
      const campaignType = payload.campaignType as string;
      const budget = payload.budget as string;
      const deadline = payload.deadline as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'New Campaign Opportunity!',
        promoDetails: `A new ${campaignType} campaign from ${brandName} is available!\n\nBudget: ${budget}\nDeadline: ${deadline}\n\nThis matches your profile - apply now!`,
        cta: 'View Opportunity',
        promoCode: '',
        validityPeriod: 'before deadline',
      }, correlationId);
    },

    async campaign_assignment(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const brandName = payload.brandName as string;
      const campaignName = payload.campaignName as string;
      const payment = payload.payment as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Campaign Assigned to You! 🎉',
        promoDetails: `You've been selected for "${campaignName}" by ${brandName}!\n\nCompensation: ${payment}\n\nCheck the app for full details and guidelines.`,
        cta: 'Accept Campaign',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async payment_released(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const amount = payload.amount as string;
      const campaignName = payload.campaignName as string;
      const balance = payload.newBalance as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Payment Released! 💰',
        promoDetails: `Your payment of ${amount} for "${campaignName}" has been released.\n\nNew Balance: ${balance}`,
        cta: 'View Transactions',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async deadline_reminder(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const campaignName = payload.campaignName as string;
      const deadline = payload.deadline as string;
      const deliverable = payload.deliverable as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Content Deadline Reminder',
        promoDetails: `Your submission for "${campaignName}" is due soon!\n\nDeliverable: ${deliverable}\nDeadline: ${deadline}\n\nSubmit your content to receive payment.`,
        cta: 'Submit Content',
        promoCode: '',
        validityPeriod: 'before deadline',
      }, correlationId);
    },

    async performance_bonus(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bonusAmount = payload.bonusAmount as string;
      const reason = payload.reason as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Performance Bonus Earned! 🎊',
        promoDetails: `Congratulations! You've earned a bonus of ${bonusAmount}.\n\nReason: ${reason}\n\nKeep up the great work!`,
        cta: 'View Bonus Details',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },
  },
};

/**
 * DOOH Mobile WhatsApp Integration
 * Handles notifications for digital out-of-home advertising screen alerts.
 */
export const doohMobileIntegration: AppIntegration = {
  app: 'doohMobile',
  name: 'DOOH Mobile',
  description: 'Digital out-of-home advertising network with mobile screen placements',

  whatsappNotifications: [
    {
      event: 'screen_offline',
      templateType: 'delivery_update',
      description: 'Alert owner when their screen goes offline',
    },
    {
      event: 'screen_online',
      templateType: 'order_confirmation',
      description: 'Confirm screen is back online',
    },
    {
      event: 'content_approved',
      templateType: 'campaign_promotion',
      description: 'Notify when scheduled content is approved',
    },
    {
      event: 'content_rejected',
      templateType: 'delivery_update',
      description: 'Notify when content needs revision',
    },
    {
      event: 'earnings_updated',
      templateType: 'order_confirmation',
      description: 'Notify screen owners of new earnings',
    },
    {
      event: 'maintenance_required',
      templateType: 'appointment_reminder',
      description: 'Alert for scheduled maintenance',
    },
  ],

  eventHandlers: {
    async screen_offline(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const screenId = payload.screenId as string;
      const location = payload.location as string;
      const offlineSince = payload.offlineSince as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Screen Offline Alert ⚠️',
        promoDetails: `Your screen at ${location} (ID: ${screenId}) has gone offline.\n\nOffline since: ${offlineSince}\n\nPlease check the power supply and internet connection.`,
        cta: 'View Screen Status',
        promoCode: '',
        validityPeriod: 'immediately',
      }, correlationId);
    },

    async screen_online(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const screenId = payload.screenId as string;
      const location = payload.location as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Screen Back Online ✓',
        promoDetails: `Your screen at ${location} (ID: ${screenId}) is now online and displaying content.\n\nAll systems operational!`,
        cta: 'View Screen Dashboard',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async content_approved(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const contentName = payload.contentName as string;
      const screenId = payload.screenId as string;
      const startTime = payload.startTime as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Content Approved! ✓',
        promoDetails: `Your content "${contentName}" has been approved for screen ${screenId}.\n\nScheduling starting: ${startTime}`,
        cta: 'View Schedule',
        promoCode: '',
        validityPeriod: 'from start time',
      }, correlationId);
    },

    async content_rejected(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const contentName = payload.contentName as string;
      const rejectionReason = payload.rejectionReason as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Content Update Required',
        promoDetails: `Your content "${contentName}" needs revision:\n\n${rejectionReason}\n\nPlease update and resubmit.`,
        cta: 'Edit Content',
        promoCode: '',
        validityPeriod: 'to avoid delays',
      }, correlationId);
    },

    async earnings_updated(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const amount = payload.amount as string;
      const period = payload.period as string;
      const totalEarnings = payload.totalEarnings as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'New Earnings! 💰',
        promoDetails: `You've earned ${amount} for ${period}!\n\nTotal earnings this month: ${totalEarnings}`,
        cta: 'View Breakdown',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async maintenance_required(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const screenId = payload.screenId as string;
      const maintenanceDate = payload.maintenanceDate as string;
      const maintenanceType = payload.maintenanceType as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Scheduled Maintenance',
        promoDetails: `Screen ${screenId} scheduled maintenance:\n\nType: ${maintenanceType}\nDate: ${maintenanceDate}\n\nYour screen may be offline during this time.`,
        cta: 'Reschedule',
        promoCode: '',
        validityPeriod: 'before scheduled date',
      }, correlationId);
    },
  },
};

/**
 * Hotel OTA WhatsApp Integration
 * Handles notifications for hotel bookings and travel updates.
 */
export const hotelOTAIntegration: AppIntegration = {
  app: 'hotelOTA',
  name: 'ReZ Hotel OTA',
  description: 'Online travel agency for hotel bookings and travel services',

  whatsappNotifications: [
    {
      event: 'booking_confirmed',
      templateType: 'order_confirmation',
      description: 'Send booking confirmation with details',
    },
    {
      event: 'booking_cancelled',
      templateType: 'delivery_update',
      description: 'Confirm booking cancellation',
    },
    {
      event: 'check_in_reminder',
      templateType: 'appointment_reminder',
      description: 'Remind guest before check-in date',
      delaySeconds: 86400, // 24 hours before
    },
    {
      event: 'check_out_reminder',
      templateType: 'appointment_reminder',
      description: 'Remind guest before check-out',
      delaySeconds: 43200, // 12 hours before
    },
    {
      event: 'special_offer',
      templateType: 'win_back',
      description: 'Send personalized hotel offers to past guests',
      conditions: [
        { field: 'lastStayDate', operator: 'greaterThan', value: 30 }, // days ago
      ],
    },
    {
      event: 'payment_confirmed',
      templateType: 'order_confirmation',
      description: 'Confirm payment for booking',
    },
  ],

  eventHandlers: {
    async booking_confirmed(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bookingRef = payload.bookingRef as string;
      const hotelName = payload.hotelName as string;
      const checkIn = payload.checkIn as string;
      const checkOut = payload.checkOut as string;
      const roomType = payload.roomType as string;
      const totalAmount = payload.totalAmount as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Booking Confirmed! ✓',
        promoDetails: `Your reservation is confirmed!\n\nRef: ${bookingRef}\n${hotelName}\n${roomType}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\nTotal: ${totalAmount}`,
        cta: 'View Booking',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async booking_cancelled(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bookingRef = payload.bookingRef as string;
      const refundAmount = payload.refundAmount as string;
      const refundDays = payload.refundDays as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Booking Cancelled',
        promoDetails: `Your booking ${bookingRef} has been cancelled.\n\nRefund: ${refundAmount}\nProcessing time: ${refundDays}`,
        cta: 'View Refund Status',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async check_in_reminder(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bookingRef = payload.bookingRef as string;
      const hotelName = payload.hotelName as string;
      const checkInTime = payload.checkInTime as string;
      const hotelAddress = payload.hotelAddress as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Check-in Tomorrow! 🏨',
        promoDetails: `Reminder: Check-in tomorrow for booking ${bookingRef}\n\n${hotelName}\nAddress: ${hotelAddress}\nCheck-in: ${checkInTime}\n\nHave a wonderful stay!`,
        cta: 'Get Directions',
        promoCode: '',
        validityPeriod: 'tomorrow',
      }, correlationId);
    },

    async check_out_reminder(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bookingRef = payload.bookingRef as string;
      const checkoutTime = payload.checkoutTime as string;
      const extras = payload.extras as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Check-out Today',
        promoDetails: `Reminder: Check-out today for booking ${bookingRef}\n\nCheckout time: ${checkoutTime}\nExtras: ${extras}\n\nSafe travels!`,
        cta: 'Extend Stay',
        promoCode: '',
        validityPeriod: 'today',
      }, correlationId);
    },

    async special_offer(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const hotelName = payload.hotelName as string;
      const discount = payload.discount as string;
      const promoCode = payload.promoCode as string;
      const validity = payload.validity as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Special Offer Just for You! 🌟',
        promoDetails: `Welcome back! As a valued guest, enjoy ${discount} off your next stay at ${hotelName}.\n\nUse code: ${promoCode}\n\nValid for ${validity}`,
        cta: 'Book Now',
        promoCode: promoCode,
        validityPeriod: validity,
      }, correlationId);
    },

    async payment_confirmed(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const bookingRef = payload.bookingRef as string;
      const amount = payload.amount as string;
      const paymentMethod = payload.paymentMethod as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Payment Confirmed',
        promoDetails: `Payment of ${amount} received for booking ${bookingRef}.\n\nMethod: ${paymentMethod}\n\nThank you for your booking!`,
        cta: 'View Booking',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },
  },
};

/**
 * Rendez WhatsApp Integration
 * Handles notifications for restaurant reservations and dining experiences.
 */
export const rendezIntegration: AppIntegration = {
  app: 'rendez',
  name: 'ReZ Rendez',
  description: 'Restaurant reservation and dining experience platform',

  whatsappNotifications: [
    {
      event: 'reservation_confirmed',
      templateType: 'order_confirmation',
      description: 'Confirm reservation with restaurant details',
    },
    {
      event: 'reservation_reminder',
      templateType: 'appointment_reminder',
      description: 'Remind guest 24 hours before reservation',
      delaySeconds: 86400,
    },
    {
      event: 'reservation_cancelled',
      templateType: 'delivery_update',
      description: 'Confirm cancellation',
    },
    {
      event: 'table_ready',
      templateType: 'delivery_update',
      description: 'Notify when table is ready (waitlist)',
    },
    {
      event: 'special_occasion',
      templateType: 'campaign_promotion',
      description: 'Special offers for birthdays, anniversaries',
    },
    {
      event: 'review_request',
      templateType: 'win_back',
      description: 'Request review after dining',
      delaySeconds: 86400, // 24 hours after
    },
  ],

  eventHandlers: {
    async reservation_confirmed(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const reservationId = payload.reservationId as string;
      const restaurantName = payload.restaurantName as string;
      const dateTime = payload.dateTime as string;
      const partySize = payload.partySize as string;
      const specialRequests = payload.specialRequests as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Reservation Confirmed! ✓',
        promoDetails: `Your table is reserved!\n\n${restaurantName}\n${dateTime}\nParty of ${partySize}\n${specialRequests ? `Special requests: ${specialRequests}` : ''}`,
        cta: 'View Reservation',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async reservation_reminder(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const restaurantName = payload.restaurantName as string;
      const dateTime = payload.dateTime as string;
      const partySize = payload.partySize as string;
      const address = payload.address as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'See You Tomorrow! 🍽️',
        promoDetails: `Reminder: Your reservation tomorrow\n\n${restaurantName}\n${dateTime}\nParty of ${partySize}\n${address}`,
        cta: 'Get Directions',
        promoCode: '',
        validityPeriod: 'tomorrow',
      }, correlationId);
    },

    async reservation_cancelled(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const reservationId = payload.reservationId as string;
      const restaurantName = payload.restaurantName as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Reservation Cancelled',
        promoDetails: `Your reservation at ${restaurantName} (${reservationId}) has been cancelled.\n\nWe hope to see you again soon!`,
        cta: 'Make New Reservation',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },

    async table_ready(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const restaurantName = payload.restaurantName as string;
      const estimatedWait = payload.estimatedWait as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Your Table is Ready! 🎉',
        promoDetails: `${restaurantName}\n\nYour table is ready! Please check in with the host within ${estimatedWait}.\n\nSee you at the table!`,
        cta: 'Check In Now',
        promoCode: '',
        validityPeriod: 'now',
      }, correlationId);
    },

    async special_occasion(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const occasion = payload.occasion as string;
      const restaurantName = payload.restaurantName as string;
      const offer = payload.offer as string;

      return await sendWhatsAppMessage(phone!, {
        headline: `Happy ${occasion}! 🎊`,
        promoDetails: `Celebrate your ${occasion} at ${restaurantName}!\n\n${offer}\n\nBook now and make it memorable!`,
        cta: 'Book Table',
        promoCode: 'CELEBRATE',
        validityPeriod: 'this month',
      }, correlationId);
    },

    async review_request(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const restaurantName = payload.restaurantName as string;
      const reservationId = payload.reservationId as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'How Was Your Meal?',
        promoDetails: `Hope you enjoyed your visit to ${restaurantName}!\n\nShare your experience and help other food lovers discover great spots.\n\nIt only takes a minute!`,
        cta: 'Write Review',
        promoCode: '',
        validityPeriod: '',
      }, correlationId);
    },
  },
};

/**
 * Food Delivery WhatsApp Integration
 * Handles notifications for food orders and delivery updates.
 */
export const foodDeliveryIntegration: AppIntegration = {
  app: 'foodDelivery',
  name: 'ReZ Food Delivery',
  description: 'Food delivery service connecting users with local restaurants',

  whatsappNotifications: [
    {
      event: 'order_placed',
      templateType: 'order_confirmation',
      description: 'Confirm order with restaurant and items',
    },
    {
      event: 'order_preparing',
      templateType: 'delivery_update',
      description: 'Notify when restaurant starts preparing',
    },
    {
      event: 'order_ready_pickup',
      templateType: 'delivery_update',
      description: 'Notify when order is ready for pickup',
    },
    {
      event: 'driver_assigned',
      templateType: 'delivery_update',
      description: 'Notify when driver is assigned',
    },
    {
      event: 'order_out_for_delivery',
      templateType: 'delivery_update',
      description: 'Notify when driver picks up order',
    },
    {
      event: 'order_arriving',
      templateType: 'delivery_update',
      description: 'Notify when order is approaching',
      delaySeconds: 600, // 10 minutes before arrival
    },
    {
      event: 'order_delivered',
      templateType: 'order_confirmation',
      description: 'Confirm delivery completion',
    },
    {
      event: 'order_cancelled',
      templateType: 'delivery_update',
      description: 'Notify of cancellation with refund info',
    },
    {
      event: 'cart_abandoned',
      templateType: 'abandonment_recovery',
      description: 'Re-engage users who abandoned cart',
      delaySeconds: 3600, // 1 hour after abandonment
    },
    {
      event: 'promo_offer',
      templateType: 'campaign_promotion',
      description: 'Send promotional offers',
    },
  ],

  eventHandlers: {
    async order_placed(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const restaurantName = payload.restaurantName as string;
      const items = payload.items as string;
      const total = payload.total as string;
      const estimatedTime = payload.estimatedTime as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        items,
        total,
        deliveryType: 'delivery',
        estimatedTime,
      }, correlationId);
    },

    async order_preparing(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const restaurantName = payload.restaurantName as string;
      const estimatedTime = payload.estimatedTime as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Being Prepared',
        message: `${restaurantName} is preparing your order.\nEstimated ready time: ${estimatedTime}`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async order_ready_pickup(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const restaurantName = payload.restaurantName as string;
      const pickupCode = payload.pickupCode as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Ready for Pickup',
        message: `Your order from ${restaurantName} is ready!\nPickup Code: ${pickupCode}\nShow this code at the counter.`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async driver_assigned(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const driverName = payload.driverName as string;
      const vehicleInfo = payload.vehicleInfo as string;
      const estimatedArrival = payload.estimatedArrival as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Driver Assigned',
        message: `Your order is on its way!\nDriver: ${driverName}\nVehicle: ${vehicleInfo}\nETA: ${estimatedArrival}`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async order_out_for_delivery(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const driverName = payload.driverName as string;
      const estimatedArrival = payload.estimatedArrival as string;
      const trackingUrl = payload.trackingUrl as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Out for Delivery',
        message: `${driverName} has picked up your order!\nETA: ${estimatedArrival}\nTrack live: ${trackingUrl}`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async order_arriving(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const driverName = payload.driverName as string;
      const minutesAway = payload.minutesAway as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Almost There!',
        message: `${driverName} is ${minutesAway} away!\n\nPlease ensure someone is available to receive the order.`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async order_delivered(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const restaurantName = payload.restaurantName as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Delivered!',
        message: `Your order from ${restaurantName} has been delivered! 🎉\n\nEnjoy your meal! Bon appetit!`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async order_cancelled(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const orderId = payload.orderId as string;
      const refundAmount = payload.refundAmount as string;
      const refundTime = payload.refundTime as string;

      return await sendWhatsAppMessage(phone!, {
        orderId,
        status: 'Cancelled',
        message: `Order ${orderId} has been cancelled.\n\nRefund: ${refundAmount}\nProcessing time: ${refundTime}`,
        supportPhone: '+1-800-REZ-HELP',
      }, correlationId);
    },

    async cart_abandoned(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const cartItems = payload.cartItems as string;
      const subtotal = payload.subtotal as string;
      const checkoutUrl = payload.checkoutUrl as string;

      return await sendWhatsAppMessage(phone!, {
        headline: 'Complete Your Order!',
        promoDetails: cartItems,
        cta: 'Continue to Checkout',
        promoCode: 'QUICK10',
        validityPeriod: '24 hours',
        cartItems,
        subtotal,
        checkoutLink: checkoutUrl,
      }, correlationId);
    },

    async promo_offer(context: EventContext): Promise<SendResult> {
      const { payload, phone, correlationId } = context;

      const offerTitle = payload.offerTitle as string;
      const offerDetails = payload.offerDetails as string;
      const promoCode = payload.promoCode as string;
      const validity = payload.validity as string;

      return await sendWhatsAppMessage(phone!, {
        headline: offerTitle,
        promoDetails: offerDetails,
        cta: 'Order Now',
        promoCode: promoCode,
        validityPeriod: validity,
      }, correlationId);
    },
  },
};

// =============================================================================
// Integration Registry
// =============================================================================

export const APP_INTEGRATIONS: Record<AppType, AppIntegration> = {
  adBazaar: adBazaarIntegration,
  creators: creatorsIntegration,
  doohMobile: doohMobileIntegration,
  hotelOTA: hotelOTAIntegration,
  rendez: rendezIntegration,
  foodDelivery: foodDeliveryIntegration,
};

/**
 * Get integration for a specific app
 */
export function getIntegration(app: AppType): AppIntegration | undefined {
  return APP_INTEGRATIONS[app];
}

/**
 * Get all integrations
 */
export function getAllIntegrations(): AppIntegration[] {
  return Object.values(APP_INTEGRATIONS);
}

/**
 * Get integration by event name
 */
export function getIntegrationByEvent(
  app: AppType,
  eventName: string
): AppIntegration | undefined {
  const integration = APP_INTEGRATIONS[app];
  if (!integration) return undefined;

  const notification = integration.whatsappNotifications.find(
    (n) => n.event === eventName
  );

  return notification ? integration : undefined;
}

// =============================================================================
// Core WhatsApp Sending Function
// =============================================================================

interface SendMessageParams {
  recipientPhone: string;
  sourceApp: AppType;
  correlationId: string;
}

/**
 * Core function to send WhatsApp messages via the communications platform
 */
async function sendWhatsAppMessage(
  phone: string,
  templateData: Record<string, string>,
  correlationId: string,
  templateType: WhatsAppTemplateType = 'order_confirmation'
): Promise<SendResult> {
  try {
    const response = await fetch(
      `${process.env.COMMUNICATIONS_API_URL}/api/whatsapp/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKENS_JSON
            ? JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON)[
                'communications-platform'
              ] || ''
            : '',
        },
        body: JSON.stringify({
          recipientPhone: phone,
          templateType,
          templateData,
          metadata: {
            sourceApp: 'app-integrations',
            correlationId,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to send message',
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageSid: result.messageSid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send WhatsApp message', {
      error: errorMessage,
      correlationId,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Trigger an event for a specific app integration
 */
export async function triggerAppEvent(
  app: AppType,
  event: string,
  payload: Record<string, unknown>,
  phone: string,
  userId?: string
): Promise<SendResult> {
  const integration = APP_INTEGRATIONS[app];

  if (!integration) {
    return {
      success: false,
      error: `Unknown app: ${app}`,
    };
  }

  const handler = integration.eventHandlers[event];
  if (!handler) {
    return {
      success: false,
      error: `Unknown event: ${event} for app: ${app}`,
    };
  }

  const correlationId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await handler({
    app,
    event,
    payload,
    userId,
    phone,
    correlationId,
  });
}

/**
 * Get supported events for an app
 */
export function getSupportedEvents(app: AppType): string[] {
  const integration = APP_INTEGRATIONS[app];
  if (!integration) return [];

  return integration.whatsappNotifications.map((n) => n.event);
}

/**
 * Health check for all integrations
 */
export async function checkIntegrationsHealth(): Promise<Record<AppType, boolean>> {
  const health: Record<AppType, boolean> = {
    adBazaar: false,
    creators: false,
    doohMobile: false,
    hotelOTA: false,
    rendez: false,
    foodDelivery: false,
  };

  // Check communications API connectivity
  try {
    const response = await fetch(
      `${process.env.COMMUNICATIONS_API_URL}/whatsapp/status`,
      {
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKENS_JSON
            ? JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON)[
                'communications-platform'
              ] || ''
            : '',
        },
      }
    );

    if (response.ok) {
      // If API is healthy, all integrations are considered healthy
      for (const app of Object.keys(health) as AppType[]) {
        health[app] = true;
      }
    }
  } catch {
    // Integration health check failed
    logger.error('Integration health check failed');
  }

  return health;
}

// =============================================================================
// Template Type Mapping
// =============================================================================

/**
 * Maps app-specific events to WhatsApp template types
 */
export function getTemplateTypeForEvent(
  app: AppType,
  event: string
): WhatsAppTemplateType | undefined {
  const integration = APP_INTEGRATIONS[app];
  if (!integration) return undefined;

  const notification = integration.whatsappNotifications.find(
    (n) => n.event === event
  );

  return notification?.templateType;
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkNotification(
  app: AppType,
  event: string,
  users: Array<{ phone: string; userId: string; payload: Record<string, unknown> }>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const user of users) {
    const result = await triggerAppEvent(
      app,
      event,
      user.payload,
      user.phone,
      user.userId
    );

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(`${user.userId}: ${result.error}`);
    }
  }

  return results;
}
