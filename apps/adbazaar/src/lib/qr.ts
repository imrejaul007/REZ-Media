import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

export async function generateQRCode(slug: string): Promise<string> {
  const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/scan/${slug}`
  return QRCode.toDataURL(scanUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  })
}

export function generateSlug(): string {
  return randomUUID()
}
