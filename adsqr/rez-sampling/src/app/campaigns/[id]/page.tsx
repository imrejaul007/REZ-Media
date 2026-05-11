import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignDetail({ params }: PageProps) {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/login" className="text-indigo-600">Login to continue</Link>
      </div>
    )
  }

  // Get campaign with QR codes
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('brand_id', user.id)
    .single()

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Campaign Not Found</h1>
          <Link href="/" className="text-indigo-600">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  // Get QR codes
  const { data: qrCodes } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  // Get scan events
  const { data: scanEvents } = await supabase
    .from('scan_events')
    .select('*')
    .eq('campaign_id', id)

  // Get analytics from funnel view
  const { data: funnel } = await supabase
    .from('attribution_funnel')
    .select('*')
    .eq('campaign_id', id)

  const totalScans = scanEvents?.length || 0
  const uniqueScanners = new Set(scanEvents?.map(s => s.user_id).filter(Boolean)).size
  const coinsUsed = campaign.coins_used || 0
  const budget = campaign.coin_budget || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
                ← Back to Campaigns
              </Link>
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {campaign.status}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/campaigns/${id}/edit`}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Edit
              </Link>
              <Link
                href={`/api/campaigns/${id}/qr/download`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Download QR Codes
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Total Scans</p>
            <p className="text-3xl font-bold text-indigo-600">{totalScans}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Unique Users</p>
            <p className="text-3xl font-bold text-green-600">{uniqueScanners}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Coins Used</p>
            <p className="text-3xl font-bold text-orange-600">{coinsUsed.toLocaleString()}</p>
            <p className="text-xs text-gray-400">of {budget.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">QR Codes</p>
            <p className="text-3xl font-bold text-blue-600">{qrCodes?.length || 0}</p>
          </div>
        </div>

        {/* QR Codes Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">QR Codes</h2>
              <Link
                href={`/campaigns/${id}/qr/new`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                + Add QR Code
              </Link>
            </div>
          </div>

          {qrCodes && qrCodes.length > 0 ? (
            <div className="divide-y">
              {qrCodes.map((qr) => (
                <div key={qr.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <Image src={qr.qr_image_url} alt={qr.qr_label} width={64} height={64} className="w-16 h-16 rounded" />
                    <div>
                      <p className="font-medium">{qr.qr_label || 'Unnamed QR'}</p>
                      <p className="text-sm text-gray-500">{qr.location_name || 'No location'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{qr.scan_count || 0} scans</p>
                    <p className="text-sm text-gray-500">{qr.unique_scans || 0} unique</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No QR codes yet</p>
              <Link href={`/campaigns/${id}/qr/new`} className="text-indigo-600 mt-2 inline-block">
                Create your first QR code
              </Link>
            </div>
          )}
        </div>

        {/* Rewards Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Rewards Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-sm">Scan Reward</p>
              <p className="text-2xl font-bold">{campaign.scan_reward || 10} coins</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Visit Reward</p>
              <p className="text-2xl font-bold">{campaign.visit_reward || 25} coins</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Purchase Reward</p>
              <p className="text-2xl font-bold">{campaign.purchase_reward || 50} coins</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Brand Coins</p>
              <p className="text-2xl font-bold">{campaign.brand_coins_reward || 0} coins</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
