// Video Landing Template - AdsQr MVP Phase 4
interface VideoTemplateProps {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
  bannerUrl?: string
  videoUrl?: string
  ctaText?: string
  ctaUrl?: string
}

export default function VideoTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1',
  bannerUrl,
  videoUrl,
  ctaText = 'Learn More',
  ctaUrl
}: VideoTemplateProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Video Hero Section */}
      <div className="relative">
        {videoUrl ? (
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-64 md:h-96 object-cover"
          />
        ) : bannerUrl ? (
          <img
            src={bannerUrl}
            alt={campaignName}
            className="w-full h-64 md:h-96 object-cover"
          />
        ) : (
          <div
            className="w-full h-64 md:h-96 flex items-center justify-center"
            style={{ backgroundColor: brandColor }}
          >
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-lg opacity-80">Watch the Video</p>
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />

        {/* Campaign info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-sm uppercase tracking-wider opacity-75 mb-2">{campaignName}</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{headline}</h1>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {details && (
          <div className="prose prose-invert mb-8">
            <p className="text-gray-300 text-lg leading-relaxed">{details}</p>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold mb-1">Ready to get started?</h3>
              <p className="text-gray-400">Join thousands of happy customers</p>
            </div>
            <a
              href={ctaUrl || '#'}
              className="px-8 py-3 rounded-full font-semibold text-white transition hover:scale-105"
              style={{ backgroundColor: brandColor }}
            >
              {ctaText}
            </a>
          </div>
        </div>

        {/* Rewards Section */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: brandColor }}>{scanReward}</p>
            <p className="text-sm text-gray-400">Scan Coins</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: brandColor }}>{visitReward}</p>
            <p className="text-sm text-gray-400">Visit Coins</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: brandColor }}>{purchaseReward}</p>
            <p className="text-sm text-gray-400">Purchase Coins</p>
          </div>
        </div>

        {/* Terms */}
        {terms && (
          <div className="text-center text-gray-500 text-sm">
            <p>* {terms}</p>
          </div>
        )}
      </div>
    </div>
  )
}
