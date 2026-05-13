import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

const BUCKET = 'listing-images'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // AB-CROSS-02 FIX: Only vendors can upload listing images.
    // Buyers do not have listing image upload permissions.
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: userRow } = await serviceClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (userRow?.role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendors can upload listing images' }, { status: 403 })
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 400 })
    }

    // Derive extension from the validated MIME type (not user-supplied filename) to prevent path traversal
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const ext = mimeToExt[file.type] ?? 'jpg'
    const filename = `${user.id}/${Date.now()}-${randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload with service-role client (bypasses storage RLS)
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      logger.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: publicUrlData } = serviceClient.storage.from(BUCKET).getPublicUrl(filename)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (e) {
    logger.error('POST /api/upload/image error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
