import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Listing } from '@/types'
import ListingCard from '@/components/listing/ListingCard'

export const dynamic = 'force-dynamic'

interface VendorPublicProfile {
  id: string
  name: string
  company_name: string | null
  city: string | null
  verified: boolean
  created_at: string
}

export default async function PublicVendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: vendor, error: vendorError } = await supabase
    .from('users')
    .select('id, name, company_name, city, verified, created_at')
    .eq('id', id)
    .eq('role', 'vendor')
    .single()

  if (vendorError || !vendor) {
    notFound()
  }

  const vendorProfile = vendor as VendorPublicProfile

  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('vendor_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const activeListings = (listings ?? []) as Listing[]

  const memberSince = new Date(vendorProfile.created_at).getFullYear()

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs mb-6 flex items-center gap-1" style={{ color: '#737373' }}>
        <Link href="/browse" className="hover:text-white">Browse</Link>
        <span>/</span>
        <span style={{ color: '#a3a3a3' }}>{vendorProfile.name}</span>
      </nav>

      {/* Vendor header card */}
      <div
        className="rounded-xl border p-6 mb-8"
        style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
      >
        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#2a2a2a', color: '#f59e0b' }}
          >
            {vendorProfile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{vendorProfile.name}</h1>
              {vendorProfile.verified && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: '#052916', color: '#4ade80', border: '1px solid #14532d' }}
                >
                  Verified
                </span>
              )}
            </div>
            {vendorProfile.company_name && (
              <p className="text-sm mt-1" style={{ color: '#a3a3a3' }}>{vendorProfile.company_name}</p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {vendorProfile.city && (
                <span className="text-xs flex items-center gap-1" style={{ color: '#737373' }}>
                  &#128205; {vendorProfile.city}
                </span>
              )}
              <span className="text-xs flex items-center gap-1" style={{ color: '#737373' }}>
                &#128197; Member since {memberSince}
              </span>
              <span className="text-xs" style={{ color: '#737373' }}>
                {activeListings.length} active listing{activeListings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active listings */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Active Listings
        </h2>
        {activeListings.length === 0 ? (
          <div
            className="rounded-xl border p-10 text-center"
            style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
          >
            <p className="text-sm" style={{ color: '#737373' }}>No active listings at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
