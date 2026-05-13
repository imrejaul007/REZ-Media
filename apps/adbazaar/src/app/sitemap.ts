import { createServerClient } from '@/lib/supabase'

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://adbazaar.in'

  const staticUrls = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/browse`, lastModified: new Date() },
  ]

  // Skip DB query if Supabase is not configured (e.g. during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return staticUrls
  }

  try {
    const supabase = createServerClient()
    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')

    const listingUrls = (listings ?? []).map((l) => ({
      url: `${baseUrl}/listing/${l.id}`,
      lastModified: new Date(l.updated_at),
    }))

    return [...staticUrls, ...listingUrls]
  } catch {
    return staticUrls
  }
}
