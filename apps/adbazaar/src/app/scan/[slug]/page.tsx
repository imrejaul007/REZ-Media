export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { ScanPageClient } from './ScanPageClient'

interface ScanPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ coins?: string; reason?: string; scan_event_id?: string; merchant?: string }>
}

async function getQRData(slug: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('qr_codes')
    .select('*, users!brand_id(name, company_name)')
    .eq('qr_slug', slug)
    .single()
  return data
}

export default async function ScanPage({ params, searchParams }: ScanPageProps) {
  const { slug } = await params
  const { coins: coinsParam, reason, scan_event_id, merchant } = await searchParams
  const coins = parseInt(coinsParam || '0', 10)

  const qr = await getQRData(slug).catch(() => null)

  // AB-C1 FIX: If the QR scan redirected with scan_event_id, use the client component
  // to handle authenticated coin credit. The server component renders the client component
  // which calls the POST endpoint with the session cookie for authentication.
  if (scan_event_id && merchant && qr) {
    const qrData = qr as { users?: { company_name?: string; name?: string } | { company_name?: string; name?: string }[] | null } | null
    const qrUser = Array.isArray(qrData?.users) ? qrData.users[0] : (qrData?.users ?? null)
    const brandName = qrUser?.company_name || qrUser?.name || 'this brand'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    return (
      <ScanPageClient
        slug={slug}
        scanEventId={scan_event_id}
        merchantId={merchant}
        brandName={brandName}
        appUrl={appUrl}
      />
    )
  }

  if (!qr) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
        style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-2xl font-extrabold tracking-tight">
            Ad<span style={{ color: '#f59e0b' }}>Bazaar</span>
          </span>
          <div>
            <div className="text-4xl mb-3">404</div>
            <p className="text-base font-semibold">QR code not found</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              This QR code does not exist or has expired.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const qrData = qr as { users?: { company_name?: string; name?: string } | { company_name?: string; name?: string }[] | null } | null
  const qrUser = Array.isArray(qrData?.users) ? qrData.users[0] : (qrData?.users ?? null)
  const brandName = qrUser?.company_name || qrUser?.name || 'this brand'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const deepLink = `rez://scan?qr=${slug}&coins=${coins}`

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Brand */}
        <div>
          <span
            className="text-2xl font-extrabold tracking-tight"
          >
            Ad<span style={{ color: '#f59e0b' }}>Bazaar</span>
          </span>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Powered by REZ
          </p>
        </div>

        {/* Coin status */}
        {coins > 0 ? (
          <div>
            <div className="text-5xl font-black mb-2" style={{ color: '#f59e0b' }}>
              +{coins}
            </div>
            <p className="text-lg font-semibold">You earned {coins} REZ coins!</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              From scanning the ad by {brandName}
            </p>
          </div>
        ) : reason === 'already_scanned' ? (
          <div>
            <div className="text-4xl mb-3">⏱</div>
            <p className="text-base font-semibold">You already scanned this today</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Come back in 24 hours to earn more coins
            </p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3">📱</div>
            <p className="text-base font-semibold">Scan recorded</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Log in to REZ to earn coins on future scans
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full">
          <a
            href={deepLink}
            className="w-full py-3 rounded-xl font-semibold text-sm text-center transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#000000' }}
          >
            Open REZ App
          </a>
          <a
            href={process.env.NEXT_PUBLIC_REZ_PLAY_STORE_URL ?? 'https://play.google.com/store/apps/details?id=in.rezapp'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl font-semibold text-sm text-center border border-white/20 hover:border-white/40 transition-colors"
          >
            Download REZ
          </a>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          AdBazaar &mdash; {appUrl}
        </p>
      </div>
    </div>
  )
}
