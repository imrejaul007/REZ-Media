import Link from 'next/link'

const LOOP_STEPS = [
  { icon: '📍', label: 'Book Ad Space' },
  { icon: '📱', label: 'QR on Every Ad' },
  { icon: '🏆', label: 'Consumers Earn REZ Coins' },
  { icon: '🏪', label: 'Visit Merchant Store' },
  { icon: '📊', label: 'Full Attribution Dashboard' },
]

const STATS = [
  { value: '88+', label: 'Ad Formats' },
  { value: 'Exclusive', label: 'REZ Integration' },
  { value: 'Real', label: 'Attribution Data' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">
          Ad<span style={{ color: '#f59e0b' }}>Bazaar</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/vendor/listings/new"
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: '#f59e0b', color: '#000000' }}
          >
            List Your Space
          </Link>
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-lg font-medium border border-white/30 hover:border-white/60 transition-colors"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl font-extrabold leading-tight mb-4 tracking-tight">
          Own a Surface?{' '}
          <span style={{ color: '#f59e0b' }}>Monetize It.</span>
          <br />
          Need Eyeballs?{' '}
          <span style={{ color: '#f59e0b' }}>Buy Them.</span>
        </h1>
        <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '42rem', margin: '0 auto 2.5rem' }}>
          India&apos;s first closed-loop ad marketplace — from billboards to Instagram bios,
          from metro stations to delivery helmets.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/vendor/listings/new"
            className="px-8 py-3 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#000000' }}
          >
            List Your Ad Space
          </Link>
          <Link
            href="/browse"
            className="px-8 py-3 rounded-xl text-base font-semibold border border-white/40 hover:border-white/70 transition-colors"
          >
            Browse Ad Inventory
          </Link>
        </div>
      </section>

      {/* Closed Loop Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-bold mb-10" style={{ color: 'rgba(255,255,255,0.8)' }}>
          The Closed-Loop Difference
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          {LOOP_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className="flex flex-col items-center text-center px-4 py-5 rounded-xl"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', width: '9rem' }}
              >
                <span className="text-2xl mb-2">{step.icon}</span>
                <span className="text-xs font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>{step.label}</span>
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <span className="text-xl hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="text-center py-8 rounded-2xl"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <div className="text-3xl font-extrabold mb-1" style={{ color: '#f59e0b' }}>
                {stat.value}
              </div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-white/10" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} AdBazaar. Powered by REZ ecosystem.
      </footer>
    </div>
  )
}
