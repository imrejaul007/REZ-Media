import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  BarChart3,
  TrendingUp,
  Settings,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'REZ Attribution Dashboard',
  description: 'Real-time marketing attribution and ROI analytics platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <div className="flex">
          {/* Sidebar */}
          <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-slate-200">
            <div className="flex h-16 items-center border-b border-slate-200 px-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">REZ</span>
                </div>
                <span className="font-semibold text-slate-900">Attribution</span>
              </div>
            </div>

            <nav className="p-4 space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/campaigns"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Megaphone className="h-5 w-5" />
                <span>Campaigns</span>
              </Link>
              <Link
                href="/reports"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileText className="h-5 w-5" />
                <span>Reports</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <BarChart3 className="h-5 w-5" />
                <span>Analytics</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <TrendingUp className="h-5 w-5" />
                <span>Trends</span>
              </Link>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-64">
            {/* Header */}
            <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Attribution Dashboard
                </h1>
                <p className="text-sm text-slate-500">
                  Real-time marketing performance metrics
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search campaigns..."
                    className="w-64 h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">May 2026</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                    Live
                  </span>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
