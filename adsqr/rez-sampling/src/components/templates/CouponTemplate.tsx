// Coupon Landing Template - AdsQr MVP Phase 4
'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CouponTemplateProps {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
  bannerUrl?: string
  couponCode?: string
  discount?: string
}

export default function CouponTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1',
  bannerUrl,
  couponCode,
  discount
}: CouponTemplateProps) {
  const [claimed, setClaimed] = useState(false)
  const [code, setCode] = useState(couponCode || generateCouponCode())

  function generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  const handleClaim = async () => {
    // In production, this would call an API to record the claim
    setClaimed(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">{campaignName}</span>
          <div
            className="px-3 py-1 rounded-full text-white text-sm font-medium"
            style={{ backgroundColor: brandColor }}
          >
            Special Offer
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Coupon Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Coupon Header */}
          {bannerUrl && (
            <Image
              src={bannerUrl}
              alt={campaignName}
              width={800}
              height={160}
              className="w-full h-40 object-cover"
            />
          )}

          <div className="p-6">
            {/* Headline */}
            <h1 className="text-2xl md:text-3xl font-bold text-center mb-2" style={{ color: brandColor }}>
              {headline}
            </h1>

            {details && (
              <p className="text-gray-600 text-center mb-6">{details}</p>
            )}

            {/* Coupon Code Section */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              {!claimed ? (
                <>
                  <p className="text-sm text-gray-500 text-center mb-2">Your Exclusive Coupon Code</p>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-3xl font-mono font-bold tracking-wider">{code}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(code)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition"
                      title="Copy code"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={handleClaim}
                    className="w-full py-3 rounded-full font-semibold text-white transition hover:scale-105"
                    style={{ backgroundColor: brandColor }}
                  >
                    Claim This Offer
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: brandColor + '20' }}
                    >
                      <svg className="w-8 h-8" style={{ color: brandColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-semibold text-green-600">Offer Claimed!</p>
                  </div>
                  <p className="text-sm text-gray-500 text-center mb-2">Show this code at checkout</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl font-mono font-bold tracking-wider">{code}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(code)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Discount Badge */}
            {discount && (
              <div className="text-center mb-6">
                <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  {discount} OFF
                </span>
              </div>
            )}

            {/* Terms */}
            {terms && (
              <p className="text-xs text-gray-400 text-center">
                * {terms}
              </p>
            )}
          </div>
        </div>

        {/* Rewards Section */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Earn Even More</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{scanReward}</p>
              <p className="text-xs text-gray-500">Scan Coins</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{visitReward}</p>
              <p className="text-xs text-gray-500">Visit Coins</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{purchaseReward}</p>
              <p className="text-xs text-gray-500">Purchase Coins</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
