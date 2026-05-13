import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "AdBazaar — India's Ad Space Marketplace",
  description:
    "India's closed-loop ad marketplace. Find, book, and track billboard and retail ad spaces with QR attribution via REZ.",
  keywords: ['advertising', 'outdoor ads', 'OOH', 'billboard', 'influencer marketing', 'India', 'ad marketplace'],
  openGraph: {
    title: "AdBazaar — India's Ad Space Marketplace",
    description:
      "India's closed-loop ad marketplace. Find, book, and track billboard and retail ad spaces with QR attribution via REZ.",
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ backgroundColor: '#0f0f0f', color: '#ffffff', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
