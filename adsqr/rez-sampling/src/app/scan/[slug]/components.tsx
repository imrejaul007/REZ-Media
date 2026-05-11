// Landing Page Templates for AdsQr
// These components can be used in the scan landing page

// Template 1: Bold (Dark gradient with large text)
export function BoldTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1'
}: {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black mb-4" style={{ color: brandColor }}>
            {headline || 'SPECIAL OFFER'}
          </h1>
          <p className="text-2xl text-gray-300">{campaignName}</p>
        </div>

        {/* Offer Card */}
        <div className="bg-white rounded-3xl p-8 text-gray-900 mb-8">
          <div className="text-center mb-6">
            <p className="text-xl font-semibold mb-2">{details || 'Show this to the cashier'}</p>
            {terms && (
              <p className="text-sm text-gray-500 italic">{terms}</p>
            )}
          </div>
        </div>

        {/* Rewards */}
        <div className="bg-white/10 backdrop-blur rounded-3xl p-8 mb-8">
          <h2 className="text-center text-xl font-bold mb-6">EARN COINS</h2>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl font-black mb-2" style={{ color: brandColor }}>{scanReward}</div>
              <div className="text-sm uppercase tracking-wider">SCAN</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-2" style={{ color: brandColor }}>{visitReward}</div>
              <div className="text-sm uppercase tracking-wider">VISIT</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-2" style={{ color: brandColor }}>{purchaseReward}</div>
              <div className="text-sm uppercase tracking-wider">PURCHASE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Template 2: Minimal (Clean white with card)
export function MinimalTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1'
}: {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">{campaignName}</p>
          <h1 className="text-4xl font-bold text-gray-900">{headline || 'Special Offer'}</h1>
        </div>

        {/* Offer */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="space-y-4">
            <p className="text-gray-600 text-center text-lg">{details || 'Present this offer'}</p>
            {terms && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-400">{terms}</p>
              </div>
            )}
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Scan', value: scanReward },
            { label: 'Visit', value: visitReward },
            { label: 'Purchase', value: purchaseReward }
          ].map((reward) => (
            <div key={reward.label} className="bg-white rounded-xl p-4 text-center shadow">
              <div className="text-2xl font-bold mb-1" style={{ color: brandColor }}>
                {reward.value}
              </div>
              <div className="text-xs text-gray-500 uppercase">{reward.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Template 3: Image First (Large banner with overlay)
export function ImageFirstTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1',
  bannerUrl
}: {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
  bannerUrl?: string
}) {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Banner */}
      <div
        className="h-64 bg-cover bg-center relative"
        style={{
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : `linear-gradient(135deg, ${brandColor}, #8B5CF6)`
        }}
      >
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white text-center px-4">
            {headline || 'Special Offer'}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 relative z-10">
        {/* Content Card */}
        <div className="bg-white rounded-t-3xl p-8">
          <p className="text-center text-gray-600 mb-6">{details || 'Show to cashier'}</p>
          {terms && <p className="text-xs text-gray-400 text-center mb-6">{terms}</p>}

          {/* Rewards */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${brandColor}20` }}>
                <span className="text-2xl font-bold" style={{ color: brandColor }}>{scanReward}</span>
              </div>
              <span className="text-xs text-gray-500">Scan</span>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${brandColor}20` }}>
                <span className="text-2xl font-bold" style={{ color: brandColor }}>{visitReward}</span>
              </div>
              <span className="text-xs text-gray-500">Visit</span>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${brandColor}20` }}>
                <span className="text-2xl font-bold" style={{ color: brandColor }}>{purchaseReward}</span>
              </div>
              <span className="text-xs text-gray-500">Purchase</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800 rounded-b-3xl p-4 text-center">
          <p className="text-gray-400 text-sm">{campaignName}</p>
        </div>
      </div>
    </div>
  )
}

// Export template list for selection
export const templates = {
  bold: BoldTemplate,
  minimal: MinimalTemplate,
  imageFirst: ImageFirstTemplate
}

export type TemplateType = keyof typeof templates
