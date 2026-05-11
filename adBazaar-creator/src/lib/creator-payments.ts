/**
 * Creator Payment System
 * Handles payouts to creators
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Payment rates
const PAYMENT_MODELS = {
  sponsored_post: {
    min: 1000,
    max: 1000000,
    escrow_days: 7,
  },
  sponsored_story: {
    min: 500,
    max: 500000,
    escrow_days: 3,
  },
  sponsored_reel: {
    min: 2000,
    max: 2000000,
    escrow_days: 7,
  },
  dooh_scan: {
    min: 1,
    max: 100,
    escrow_days: 0, // Instant
  },
  retainer: {
    min: 10000,
    max: 1000000,
    escrow_days: 0,
  },
}

export interface PayoutRequest {
  creator_id: string
  amount: number
  method: 'bank_transfer' | 'upi' | 'razorpay'
  bank_account?: {
    account_number: string
    ifsc_code: string
    account_holder: string
  }
  upi_id?: string
}

export interface PaymentRecord {
  id: string
  creator_id: string
  campaign_id?: string
  amount: number
  type: 'sponsored_post' | 'story' | 'reel' | 'dooh_scan'
  status: 'pending' | 'escrow' | 'released' | 'paid' | 'failed'
  escrow_release_at?: string
  paid_at?: string
  razorpay_transfer_id?: string
}

/**
 * Create payment for creator
 */
export async function createPayment(data: {
  creator_id: string
  campaign_id: string
  type: 'sponsored_post' | 'story' | 'reel' | 'dooh_scan'
  amount: number
}): Promise<{ success: boolean; payment_id?: string; error?: string }> {
  const model = PAYMENT_MODELS[data.type]

  // Validate amount
  if (data.amount < model.min || data.amount > model.max) {
    return { success: false, error: `Amount must be between ₹${model.min} and ₹${model.max}` }
  }

  const escrow_release = model.escrow_days > 0
    ? new Date(Date.now() + model.escrow_days * 24 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString()

  const { data: payment, error } = await supabase
    .from('creator_earnings')
    .insert({
      creator_id: data.creator_id,
      source: data.type,
      campaign_id: data.campaign_id,
      amount: data.amount,
      status: 'pending',
      escrow_release_at: escrow_release,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, payment_id: payment.id }
}

/**
 * Release escrow payments (run daily cron)
 */
export async function releaseEscrowPayments(): Promise<{ released: number }> {
  const now = new Date().toISOString()

  // Find payments ready for release
  const { data: payments } = await supabase
    .from('creator_earnings')
    .select('*')
    .eq('status', 'escrow')
    .lt('escrow_release_at', now)

  if (!payments || payments.length === 0) {
    return { released: 0 }
  }

  let released = 0

  for (const payment of payments) {
    await supabase
      .from('creator_earnings')
      .update({ status: 'approved' })
      .eq('id', payment.id)
    released++
  }

  return { released }
}

/**
 * Process payout to creator
 */
export async function processPayout(
  payment_id: string,
  method: 'bank_transfer' | 'upi' | 'razorpay',
  destination: string
): Promise<{ success: boolean; transfer_id?: string; error?: string }> {
  // Get payment
  const { data: payment } = await supabase
    .from('creator_earnings')
    .select('*')
    .eq('id', payment_id)
    .single()

  if (!payment) {
    return { success: false, error: 'Payment not found' }
  }

  if (payment.status !== 'approved') {
    return { success: false, error: 'Payment not ready for payout' }
  }

  // In production: call Razorpay/Slope/Batch disbursement API
  const transfer_id = `xfer_${Date.now()}_${Math.random().toString(36).slice(2)}`

  await supabase
    .from('creator_earnings')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      razorpay_transfer_id: transfer_id,
    })
    .eq('id', payment_id)

  return { success: true, transfer_id }
}

/**
 * Get creator's pending balance
 */
export async function getPendingBalance(creator_id: string): Promise<number> {
  const { data: earnings } = await supabase
    .from('creator_earnings')
    .select('amount')
    .eq('creator_id', creator_id)
    .in('status', ['pending', 'escrow', 'approved'])

  if (!earnings) return 0

  return earnings.reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Get payment history
 */
export async function getPaymentHistory(creator_id: string, limit = 20) {
  const { data } = await supabase
    .from('creator_earnings')
    .select('*')
    .eq('creator_id', creator_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}
