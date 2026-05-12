'use client'

import { useState } from 'react'
import { Search, Filter, MoreVertical, Phone, Mail, MessageSquare, Tag, Download, UserPlus } from 'lucide-react'

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  tags: string[]
  lastContact: string
  status: 'hot' | 'warm' | 'cold'
}

const contacts: Contact[] = [
  { id: '1', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 43210', tags: ['hotel', 'premium'], lastContact: '2 hours ago', status: 'hot' },
  { id: '2', name: 'Priya Patel', email: 'priya@example.com', phone: '+91 87654 32109', tags: ['restaurant'], lastContact: '1 day ago', status: 'warm' },
  { id: '3', name: 'Amit Kumar', email: 'amit@example.com', phone: '+91 76543 21098', tags: ['retail'], lastContact: '3 days ago', status: 'warm' },
  { id: '4', name: 'Sneha Reddy', email: 'sneha@example.com', phone: '+91 65432 10987', tags: ['fitness'], lastContact: '1 week ago', status: 'cold' },
]

export default function CRMDashboard() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = contacts.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statusColors = { hot: 'bg-red-100 text-red-700', warm: 'bg-yellow-100 text-yellow-700', cold: 'bg-blue-100 text-blue-700' }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Contacts</h1>
        <nav className="space-y-1">
          {['All Contacts', 'Hot Leads', 'Active', 'Churned'].map(item => (
            <button key={item} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
              {item}
            </button>
          ))}
        </nav>
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tags</h3>
          <div className="space-y-1">
            {['hotel', 'restaurant', 'retail', 'fitness'].map(tag => (
              <button key={tag} className="w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{filtered.length} Contacts</h2>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
              <UserPlus className="w-4 h-4" /> Import
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/ -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-4 py-2 border rounded-lg">
            <option value="all">All Status</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tags</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Last Contact</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(contact => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{contact.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-600">{contact.email}</div>
                    <div className="text-gray-400">{contact.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {contact.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[contact.status]}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{contact.lastContact}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded"><Mail className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-100 rounded"><Phone className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-100 rounded"><MessageSquare className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-100 rounded"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
