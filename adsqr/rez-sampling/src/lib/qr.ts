// AdsQr MVP - Phase 1
// Generate unique slug for QR codes
export function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let slug = ''
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)]
  }
  return slug
}

// Generate QR image URL (using QR Server API)
export function generateQRImage(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adsqr.rezapp.com'
  const url = `${baseUrl}/scan/${slug}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`
}
