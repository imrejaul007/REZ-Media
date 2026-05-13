// Email utility — uses Resend when RESEND_API_KEY is set, otherwise logs to console (dev mode)
// Install: npm install resend

import escapeHtml from 'escape-html'
import logger from '@/lib/logger'

// AB3-M1 FIX: All user-supplied data passed to email templates must be escaped.
// Email templates render HTML, so user data that contains HTML/script content could
// result in stored XSS if rendered without proper escaping. Using escape-html library
// to encode: < > & " ' characters, preventing HTML injection in email content.
// All template functions below apply escapeHtml to: buyerName, vendorName, listingTitle.

interface EmailPayload {
  to: string
  subject: string
  html: string
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? 'AdBazaar <noreply@adbazaar.in>'

  if (!apiKey) {
    logger.info('[email:dev]', { subject: payload.subject, to: payload.to })
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html }),
  })

  if (!res.ok) {
    const err = await res.text()
    logger.error('[email] send failed:', err)
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function emailQuoteReceived(opts: {
  buyerEmail: string
  buyerName: string
  vendorName: string
  listingTitle: string
  amount: number
  inquiryId: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const safe = { n: escapeHtml(opts.buyerName), v: escapeHtml(opts.vendorName), t: escapeHtml(opts.listingTitle) }
  await sendEmail({
    to: opts.buyerEmail,
    subject: `Quote received for "${safe.t}"`,
    html: `
      <p>Hi ${safe.n},</p>
      <p><strong>${safe.v}</strong> has sent you a quote of <strong>₹${opts.amount.toLocaleString('en-IN')}</strong> for <em>${safe.t}</em>.</p>
      <p><a href="${appUrl}/buyer/inquiries">View and accept the quote →</a></p>
      <p style="color:#6b7280;font-size:12px">Quote is valid for 7 days. AdBazaar.</p>
    `,
  })
}

export async function emailQuoteAccepted(opts: {
  vendorEmail: string
  vendorName: string
  buyerName: string
  listingTitle: string
  amount: number
  bookingId: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const safe = { v: escapeHtml(opts.vendorName), b: escapeHtml(opts.buyerName), t: escapeHtml(opts.listingTitle) }
  await sendEmail({
    to: opts.vendorEmail,
    subject: `Booking confirmed — "${safe.t}"`,
    html: `
      <p>Hi ${safe.v},</p>
      <p><strong>${safe.b}</strong> accepted your quote and created a booking for <em>${safe.t}</em> (₹${opts.amount.toLocaleString('en-IN')}).</p>
      <p><a href="${appUrl}/vendor/bookings">View booking →</a></p>
      <p style="color:#6b7280;font-size:12px">Payment is pending. AdBazaar.</p>
    `,
  })
}

export async function emailNewBooking(opts: {
  vendorEmail: string
  vendorName: string
  buyerName: string
  listingTitle: string
  amount: number
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const safe = { v: escapeHtml(opts.vendorName), b: escapeHtml(opts.buyerName), t: escapeHtml(opts.listingTitle) }
  await sendEmail({
    to: opts.vendorEmail,
    subject: `New booking — "${safe.t}"`,
    html: `
      <p>Hi ${safe.v},</p>
      <p><strong>${safe.b}</strong> booked <em>${safe.t}</em> for ₹${opts.amount.toLocaleString('en-IN')}.</p>
      <p><a href="${appUrl}/vendor/bookings">View bookings →</a></p>
      <p style="color:#6b7280;font-size:12px">AdBazaar.</p>
    `,
  })
}

export async function emailProofUploaded(opts: {
  buyerEmail: string
  buyerName: string
  vendorName: string
  listingTitle: string
  bookingId: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const safe = { n: escapeHtml(opts.buyerName), v: escapeHtml(opts.vendorName), t: escapeHtml(opts.listingTitle) }
  await sendEmail({
    to: opts.buyerEmail,
    subject: `Proof of execution uploaded — "${safe.t}"`,
    html: `
      <p>Hi ${safe.n},</p>
      <p><strong>${safe.v}</strong> has uploaded proof of execution for <em>${safe.t}</em>. Please review and approve to release the payout.</p>
      <p><a href="${appUrl}/buyer/bookings">Review proof →</a></p>
      <p style="color:#6b7280;font-size:12px">AdBazaar.</p>
    `,
  })
}

export async function emailProofApproved(opts: {
  vendorEmail: string
  vendorName: string
  listingTitle: string
  payout: number
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const safe = { v: escapeHtml(opts.vendorName), t: escapeHtml(opts.listingTitle) }
  await sendEmail({
    to: opts.vendorEmail,
    subject: `Proof approved — payout queued for "${safe.t}"`,
    html: `
      <p>Hi ${safe.v},</p>
      <p>The buyer approved your proof of execution for <em>${safe.t}</em>. Your payout of <strong>₹${opts.payout.toLocaleString('en-IN')}</strong> has been queued.</p>
      <p><a href="${appUrl}/vendor/earnings">View earnings →</a></p>
      <p style="color:#6b7280;font-size:12px">Payouts are processed within 3-5 business days. AdBazaar.</p>
    `,
  })
}
