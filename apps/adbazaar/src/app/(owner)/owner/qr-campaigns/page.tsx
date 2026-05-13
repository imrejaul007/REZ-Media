'use client'

// Redirect to vendor QR campaigns
export default function OwnerQRCampaignsPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/vendor/qr-campaigns'
  }
  return null
}
