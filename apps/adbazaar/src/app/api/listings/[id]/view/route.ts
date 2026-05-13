import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

// AB2-H2 FIX: Known crawler/bot User-Agent patterns to exclude from view counts.
// Bots inflate view counts and skew analytics. Identifying them by UA signature is
// not perfect but covers the majority of automated crawlers.
const BOT_UA_PATTERNS = [
  /\b(googlebot|bingbot|yandexbot|baiduspider|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|crawler|spider|bot)\b/i,
  /^\s*$/, // Empty UA
]

function isBotUA(ua: string | null): boolean {
  if (!ua) return true
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(ua))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing listing id' }, { status: 400 })
  }

  const ua = req.headers.get('user-agent')
  // AB2-H2 FIX: Skip increment for known bot/crawler User-Agents
  if (isBotUA(ua)) {
    return new NextResponse(null, { status: 204 })
  }

  const supabase = createServerClient()

  // AB3-M14 FIX: Use atomic increment via database-level operation.
  // The increment_view_count function performs UPDATE view_count = view_count + 1
  // in a single atomic database operation, eliminating the race condition that
  // occurs with read-then-write patterns when multiple users view simultaneously.
  const { error } = await supabase.rpc('increment_view_count', { listing_id: id })

  if (error) {
    logger.error('[listings view] atomic increment failed', error)
  }

  // Fire and forget — always return 204
  return new NextResponse(null, { status: 204 })
}
