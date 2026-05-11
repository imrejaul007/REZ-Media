/* AdsQr MVP - Phase 1 */
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/login" className="bg-indigo-600 text-white px-6 py-3 rounded-lg">
          Login to continue
        </Link>
      </div>
    )
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('brand_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AdsQr</h1>
          <Link href="/campaigns/new" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
            + New Campaign
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">Your Campaigns</h2>

        {campaigns?.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No campaigns yet</p>
            <Link href="/campaigns/new" className="text-indigo-600 font-medium">
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns?.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                      campaign.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-4">{campaign.description || 'No description'}</p>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{campaign.scan_count || 0} scans</span>
                    <span>{(campaign.coins_used || 0)} coins used</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
