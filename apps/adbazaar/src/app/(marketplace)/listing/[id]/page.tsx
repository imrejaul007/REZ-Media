import { createServerClient } from '@/lib/supabase'
import { Metadata } from 'next'
import ListingDetailClient from './ListingDetailClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = createServerClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('title, description, city, images')
    .eq('id', id)
    .single()

  if (!listing) {
    return { title: 'Listing Not Found | AdBazaar' }
  }

  const description =
    listing.description?.slice(0, 160) ??
    `Book ${listing.title} ad space in ${listing.city}`

  return {
    title: `${listing.title} | AdBazaar`,
    description,
    openGraph: {
      title: listing.title,
      description,
      images:
        Array.isArray(listing.images) && listing.images[0]
          ? [{ url: listing.images[0] as string }]
          : [],
    },
  }
}

export default function ListingDetailPage() {
  return <ListingDetailClient />
}
