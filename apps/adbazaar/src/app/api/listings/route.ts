import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

// AB-M2 FIX: Escape SQL/ilike wildcard characters in search patterns.
// PostgreSQL ilike uses % and _ as wildcards (like SQL LIKE).
// Unescaped input could allow: % to match everything, _ to match single chars,
// or crafted patterns to bypass search intent.
// Escaping \\% and \\_ forces literal matching of these characters.
const escapeLikePattern = (s: string): string => {
  if (!s || typeof s !== 'string') return ''
  // Escape PostgreSQL LIKE/ilike special characters
  // Backslash must be escaped first, then % and _
  return s
    .replace(/\\/g, '\\\\')  // Escape existing backslashes
    .replace(/%/g, '\\%')    // Escape percent wildcards
    .replace(/_/g, '\\_')    // Escape underscore wildcards
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const city = searchParams.get('city')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const availabilityModel = searchParams.get('availabilityModel')?.trim() ?? ''
  const qrEnabled = searchParams.get('qrEnabled')
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10)))
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('freshness_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (city) {
    // AB-M2 FIX: Escape city parameter to prevent wildcard injection in ilike
    const escapedCity = escapeLikePattern(city)
    query = query.ilike('city', `%${escapedCity}%`)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (minPrice) {
    const min = parseFloat(minPrice)
    if (!isNaN(min)) {
      query = query.gte('price', min)
    }
  }

  if (maxPrice) {
    const max = parseFloat(maxPrice)
    if (!isNaN(max)) {
      query = query.lte('price', max)
    }
  }

  if (availabilityModel) {
    query = query.eq('availability_model', availabilityModel)
  }

  if (qrEnabled === 'true') {
    query = query.eq('qr_enabled', true)
  }

  if (q) {
    // AB-M2 FIX: Escape search query for ilike patterns to prevent SQL injection
    // via crafted wildcard patterns like '%' or '__admin%'
    const escaped = escapeLikePattern(q)
    // Search title or city using ilike with escaped pattern
    query = query.or(`title.ilike.%${escaped}%,city.ilike.%${escaped}%`)
  }

  const { data: listings, count, error } = await query

  if (error) {
    logger.error('GET /api/listings error', error, { path: '/api/listings' })
    return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    listings: listings ?? [],
    total,
    page,
    totalPages,
  })
}
