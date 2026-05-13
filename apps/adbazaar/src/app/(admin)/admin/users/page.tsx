export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { UserRole } from '@/types'
import { requireAdmin } from '@/lib/adminAuth'

type FilterTab = 'all' | 'vendor' | 'buyer' | 'admin'

async function getAllUsers() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('users')
    .select('id, name, email, role, city, rez_merchant_id, verified, created_at')
    .order('created_at', { ascending: false })

  return data ?? []
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireAdmin()
  const { filter } = await searchParams
  const activeFilter: FilterTab = (filter as FilterTab) ?? 'all'

  let users: Awaited<ReturnType<typeof getAllUsers>>
  try {
    users = await getAllUsers()
  } catch (err) {
    void err
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        Failed to load data. Please refresh the page.
      </div>
    )
  }

  const vendorCount = users.filter(u => u.role === UserRole.Vendor).length
  const buyerCount = users.filter(u => u.role === UserRole.Buyer).length
  const adminCount = users.filter(u => u.role === UserRole.Admin).length

  const filtered = activeFilter === 'all'
    ? users
    : users.filter(u => u.role === activeFilter)

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: users.length },
    { key: 'vendor', label: 'Vendors', count: vendorCount },
    { key: 'buyer', label: 'Buyers', count: buyerCount },
    { key: 'admin', label: 'Admins', count: adminCount },
  ]

  const statCards = [
    { label: 'Total Users', value: users.length.toLocaleString('en-IN') },
    { label: 'Vendors', value: vendorCount.toLocaleString('en-IN'), highlight: true },
    { label: 'Buyers', value: buyerCount.toLocaleString('en-IN') },
    { label: 'Admins', value: adminCount.toLocaleString('en-IN') },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-gray-500 text-sm mt-1">All registered users on the platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, highlight }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              backgroundColor: '#1a1a1a',
              border: highlight ? '1px solid rgba(245,158,11,0.4)' : '1px solid #2a2a2a',
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: highlight ? '#f59e0b' : '#ffffff' }}
            >
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <a
            key={tab.key}
            href={`/admin/users?filter=${tab.key}`}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeFilter === tab.key ? '#f59e0b' : '#1a1a1a',
              color: activeFilter === tab.key ? '#0f0f0f' : '#9ca3af',
              border: '1px solid #2a2a2a',
            }}
          >
            {tab.label} ({tab.count})
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-gray-500">No users found.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                {['Name', 'Email', 'Role', 'City', 'REZ Merchant ID', 'Verified', 'Joined'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#6b7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user: Record<string, unknown>) => (
                <tr
                  key={user.id as string}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: '1px solid #1f1f1f' }}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {user.name as string}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {user.email as string}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                      style={
                        user.role === UserRole.Vendor
                          ? { backgroundColor: '#f59e0b11', color: '#f59e0b', border: '1px solid #f59e0b33' }
                          : user.role === UserRole.Admin
                          ? { backgroundColor: '#a855f711', color: '#c084fc', border: '1px solid #a855f733' }
                          : { backgroundColor: '#3b82f611', color: '#60a5fa', border: '1px solid #3b82f633' }
                      }
                    >
                      {user.role as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {(user.city as string | null) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {(user.rez_merchant_id as string | null) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {user.verified ? (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: '#22c55e11', color: '#4ade80', border: '1px solid #22c55e33' }}
                      >
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#6b7280' }}>No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(user.created_at as string)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
