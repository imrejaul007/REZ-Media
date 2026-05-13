import { z } from 'zod'

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export const BookingCreateSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  slots: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  coinsPerScan: z.number().int().min(1).max(1000).optional(),
  visitBonusCoins: z.number().int().min(0).max(10000).optional(),
  rezMerchantId: z.string().optional().nullable(),
  creativeInstructions: z.string().max(2000).optional().nullable(),
  broadcastConfig: z
    .object({
      channel: z.enum(['push', 'whatsapp', 'sms']).optional().default('push'),
      segment: z.enum(['all', 'high_value', 'at_risk', 'new_users']).optional().default('all'),
      broadcastTitle: z.string().max(200).optional(),
      broadcastBody: z.string().max(500).optional(),
      scheduledAt: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
}).refine(
  (data) => {
    // At least one of startDate+endDate, slots, or neither must be provided
    if (data.startDate && !data.endDate) return false
    if (!data.startDate && data.endDate) return false
    return true
  },
  { message: 'Both startDate and endDate must be provided together, or neither' },
)

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>

// ---------------------------------------------------------------------------
// Inquiry
// ---------------------------------------------------------------------------

export const InquiryCreateSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  budget: z.number().positive('Budget must be positive').optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  requirements: z.string().max(2000).optional().nullable(),
})

export type InquiryCreateInput = z.infer<typeof InquiryCreateSchema>

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export const QuoteSchema = z.object({
  quoteAmount: z.number().positive('Quote amount must be positive'),
  quoteMessage: z.string().max(2000).optional().nullable(),
  validDays: z.number().int().min(1).max(90).optional().default(7),
})

export type QuoteInput = z.infer<typeof QuoteSchema>

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const ReviewCreateSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
  onTimeRating: z.number().int().min(1).max(5).optional().nullable(),
  proofQualityRating: z.number().int().min(1).max(5).optional().nullable(),
  communicationRating: z.number().int().min(1).max(5).optional().nullable(),
})

export type ReviewCreateInput = z.infer<typeof ReviewCreateSchema>

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  company_name: z.string().max(300).optional().nullable(),
  gst_number: z.string().max(15).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format').optional().or(z.literal('')).nullable(),
  pan_number: z.string().max(10).regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format').optional().or(z.literal('')).nullable(),
  city: z.string().max(100).optional().nullable(),
  rez_merchant_id: z.string().max(100).optional().nullable(),
  bank_account_name: z.string().max(200).optional().nullable(),
  bank_account_number: z.string().max(30).optional().nullable(),
  bank_ifsc: z.string().max(11).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional().or(z.literal('')).nullable(),
  upi_id: z.string().max(100).optional().nullable(),
})

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export const MessageCreateSchema = z.object({
  content: z.string().min(1).max(5000),
})

export type MessageCreateInput = z.infer<typeof MessageCreateSchema>
