/* AdsQr MVP - Phase 1 */
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AdsQr - QR Code Campaign Platform',
  description: 'Create and manage QR code campaigns with rewards',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
