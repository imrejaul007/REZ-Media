'use client'

import { useEffect, useState } from 'react'

interface ScanPageClientProps {
  slug: string
  scanEventId: string
  merchantId: string
  brandName: string
  appUrl: string
}

export function ScanPageClient({ slug, scanEventId, merchantId, brandName, appUrl }: ScanPageClientProps) {
  const [coinsEarned, setCoinsEarned] = useState<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'credited' | 'already' | 'no_merchant' | 'unauthenticated' | 'error'>('loading')

  useEffect(() => {
    if (!scanEventId) return

    const creditCoins = async () => {
      try {
        const res = await fetch(`/api/qr/scan/${slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include session cookie for auth
          body: JSON.stringify({ scanEventId }),
        })

        if (res.status === 401) {
          setStatus('unauthenticated')
          return
        }

        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          return
        }

        if (data.alreadyCredited) {
          setCoinsEarned(data.coinsEarned ?? 0)
          setStatus('already')
        } else if (data.reason === 'no_merchant') {
          setStatus('no_merchant')
        } else {
          setCoinsEarned(data.coinsEarned ?? 0)
          setStatus('credited')
        }
      } catch {
        setStatus('error')
      }
    }

    creditCoins()
  }, [slug, scanEventId])

  const deepLink = `rez://scan?qr=${slug}&coins=${coinsEarned ?? 0}`

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
          <span className="text-2xl font-extrabold tracking-tight">
            Ad<span style={{ color: '#f59e0b' }}>Bazaar</span>
          </span>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Powered by REZ
          </p>
        </div>

        {/* Coin status */}
        {status === 'loading' && (
          <div>
            <div className="text-4xl mb-3">...</div>
            <p className="text-base font-semibold">Checking your coins...</p>
          </div>
        )}

        {status === 'credited' && coinsEarned !== null && (
          <div>
            <div className="text-5xl font-black mb-2" style={{ color: '#f59e0b' }}>
              +{coinsEarned}
            </div>
            <p className="text-lg font-semibold">You earned {coinsEarned} REZ coins!</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              From scanning the ad by {brandName}
            </p>
          </div>
        )}

        {status === 'already' && coinsEarned !== null && (
          <div>
            <div className="text-4xl mb-3">&#x23F3;</div>
            <p className="text-base font-semibold">Coins already credited</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              You already earned {coinsEarned} REZ coins for this scan
            </p>
          </div>
        )}

        {status === 'unauthenticated' && (
          <div>
            <div className="text-4xl mb-3">&#x1F512;</div>
            <p className="text-base font-semibold">Sign in to earn coins</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Log in to REZ to earn coins on future scans
            </p>
          </div>
        )}

        {status === 'no_merchant' && (
          <div>
            <div className="text-4xl mb-3">&#x1F3AF;</div>
            <p className="text-base font-semibold">Scan recorded</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Coins not available for this ad yet
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="text-4xl mb-3">&#x26A0;</div>
            <p className="text-base font-semibold">Scan recorded</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Coin credit will be applied automatically
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
