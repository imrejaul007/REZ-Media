import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { getStats } from '@/lib/api'

export const metadata: Metadata = {
  title: 'ReZ CRM - Customer Relationship Management',
  description: 'Manage contacts, track activities, and build customer segments',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const stats = await getStats()

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex h-screen bg-gray-50">
          <Sidebar stats={stats} />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
