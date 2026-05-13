/**
 * SMS utility using Twilio
 *
 * Install: npm install twilio
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 */

import logger from './logger'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

// Only create client if credentials are available
const client = accountSid && authToken ? twilio(accountSid, authToken) : null

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an SMS message to a phone number
 */
export async function sendSMS(to: string, body: string): Promise<SMSResult> {
  // Validate phone number format (basic E.164 check)
  const normalizedTo = normalizePhoneNumber(to)

  if (!client || !fromNumber) {
    logger.warn('[SMS] Twilio not configured, skipping SMS to', { normalizedTo })
    return { success: false, error: 'SMS provider not configured' }
  }

  if (!normalizedTo) {
    return { success: false, error: 'Invalid phone number format' }
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: normalizedTo,
    })
    logger.info('[SMS] Sent successfully', { messageId: message.sid })
    return { success: true, messageId: message.sid }
  } catch (err) {
    logger.error('[SMS] Failed to send SMS', { error: String(err) })
    return { success: false, error: String(err) }
  }
}

/**
 * Send OTP verification code via SMS
 */
export async function sendOTP(phone: string, otp: string): Promise<SMSResult> {
  const normalizedPhone = normalizePhoneNumber(phone)
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid phone number format' }
  }

  return sendSMS(
    normalizedPhone,
    `Your AdBazaar verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`
  )
}

/**
 * Send booking confirmation SMS
 */
export async function sendBookingConfirmation(
  phone: string,
  listingTitle: string,
  amount: number
): Promise<SMSResult> {
  const normalizedPhone = normalizePhoneNumber(phone)
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid phone number format' }
  }

  return sendSMS(
    normalizedPhone,
    `AdBazaar: Your booking for "${listingTitle}" (Rs. ${amount.toLocaleString('en-IN')}) is confirmed. View details in the app.`
  )
}

/**
 * Send payment received notification
 */
export async function sendPaymentReceived(
  phone: string,
  amount: number,
  payoutDays: number
): Promise<SMSResult> {
  const normalizedPhone = normalizePhoneNumber(phone)
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid phone number format' }
  }

  return sendSMS(
    normalizedPhone,
    `AdBazaar: Payment of Rs. ${amount.toLocaleString('en-IN')} received. Payout initiated. Expect funds in ${payoutDays}-${payoutDays + 2} business days.`
  )
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Indian numbers (most common for this app)
  if (digits.length === 10) {
    return `+91${digits}`
  }

  // Already has country code
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`
  }

  // With + sign already
  if (phone.startsWith('+') && digits.length === 12) {
    return `+${digits}`
  }

  // Invalid format
  return null
}
