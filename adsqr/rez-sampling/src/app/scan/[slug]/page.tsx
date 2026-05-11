import { createClient } from '@/lib/supabase'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ template?: string }>
}

export default async function ScanPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const supabase = createClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*, campaigns(*)')
    .eq('qr_slug', slug)
    .single()

  if (!qr || !qr.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
          <p className="text-gray-500">This QR code doesn&apos;t exist or is inactive.</p>
        </div>
      </div>
    )
  }

  const campaign = qr.campaigns || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">{campaign.name || 'Special Offer!'}</h1>
        <p className="text-gray-600 mb-6">
          {campaign.description || 'Scan to claim your reward!'}
        </p>
        <div className="bg-gray-100 rounded-xl p-6 mb-6">
          <div className="text-4xl mb-2">🎁</div>
          <p className="text-sm text-gray-500">Scan Reward</p>
          <p className="text-2xl font-bold text-indigo-600">
            {campaign.scan_reward || 10} coins
          </p>
        </div>
        <p className="text-xs text-gray-400">
          QR Slug: {slug}
        </p>
      </div>
    </div>
  )
}
