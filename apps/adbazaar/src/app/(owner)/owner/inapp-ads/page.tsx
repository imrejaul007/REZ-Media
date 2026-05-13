'use client'

// Redirect to vendor in-app ads
export default function OwnerInAppAdsPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/vendor/inapp-ads'
  }
  return null
}
