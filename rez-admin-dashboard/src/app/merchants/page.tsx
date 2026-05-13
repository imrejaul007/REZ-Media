'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Ban,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Eye,
} from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import StatusBadge from '@/components/StatusBadge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/Table';
import { getMerchants, approveMerchant, rejectMerchant, suspendMerchant } from '@/lib/api';

interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  joinedAt: string;
  totalCampaigns: number;
  totalSpent: number;
  lastActiveAt: string;
}

// Mock data for demonstration
const mockMerchants: Merchant[] = [
  {
    id: '1',
    name: 'TechCorp Inc.',
    email: 'contact@techcorp.com',
    phone: '+1 555-0101',
    status: 'approved',
    joinedAt: '2025-08-15',
    totalCampaigns: 12,
    totalSpent: 42500,
    lastActiveAt: '2026-05-12',
  },
  {
    id: '2',
    name: 'Fashion Hub',
    email: 'hello@fashionhub.com',
    phone: '+1 555-0102',
    status: 'approved',
    joinedAt: '2025-09-20',
    totalCampaigns: 8,
    totalSpent: 38200,
    lastActiveAt: '2026-05-11',
  },
  {
    id: '3',
    name: 'AutoDeals',
    email: 'sales@autodeals.com',
    phone: '+1 555-0103',
    status: 'pending',
    joinedAt: '2026-05-10',
    totalCampaigns: 0,
    totalSpent: 0,
    lastActiveAt: '2026-05-10',
  },
  {
    id: '4',
    name: 'Food Delivery Pro',
    email: 'promo@fooddeliverypro.com',
    phone: '+1 555-0104',
    status: 'approved',
    joinedAt: '2025-06-05',
    totalCampaigns: 10,
    totalSpent: 24100,
    lastActiveAt: '2026-05-12',
  },
  {
    id: '5',
    name: 'TravelBook',
    email: 'partners@travelbook.com',
    phone: '+1 555-0105',
    status: 'suspended',
    joinedAt: '2025-11-12',
    totalCampaigns: 5,
    totalSpent: 18500,
    lastActiveAt: '2026-04-20',
  },
  {
    id: '6',
    name: 'Health & Wellness Co.',
    email: 'info@healthwellness.com',
    phone: '+1 555-0106',
    status: 'pending',
    joinedAt: '2026-05-08',
    totalCampaigns: 0,
    totalSpent: 0,
    lastActiveAt: '2026-05-08',
  },
  {
    id: '7',
    name: 'EduLearn Platform',
    email: 'advertise@edulearn.com',
    phone: '+1 555-0107',
    status: 'approved',
    joinedAt: '2025-07-22',
    totalCampaigns: 6,
    totalSpent: 15800,
    lastActiveAt: '2026-05-10',
  },
  {
    id: '8',
    name: 'Gaming Zone',
    email: 'marketing@gamingzone.com',
    phone: '+1 555-0108',
    status: 'rejected',
    joinedAt: '2026-04-28',
    totalCampaigns: 0,
    totalSpent: 0,
    lastActiveAt: '2026-04-28',
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMerchants() {
      try {
        const response = await getMerchants({ status: statusFilter !== 'all' ? statusFilter : undefined });
        if (response.success) {
          setMerchants(response.data.merchants);
        }
      } catch {
        setMerchants(mockMerchants);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMerchants();
  }, [statusFilter]);

  const filteredMerchants = merchants.filter((merchant) => {
    const matchesSearch =
      merchant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || merchant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await approveMerchant(id);
      if (response.success) {
        setMerchants((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'approved' } : m))
        );
      }
    } catch {
      // For demo, update locally
      setMerchants((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'approved' } : m))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await rejectMerchant(id, 'Does not meet platform requirements');
      if (response.success) {
        setMerchants((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'rejected' } : m))
        );
      }
    } catch {
      setMerchants((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'rejected' } : m))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await suspendMerchant(id, 'Violation of terms of service');
      if (response.success) {
        setMerchants((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'suspended' } : m))
        );
      }
    } catch {
      setMerchants((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'suspended' } : m))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const openMerchantDetails = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setIsModalOpen(true);
  };

  const statusCounts = {
    all: merchants.length,
    pending: merchants.filter((m) => m.status === 'pending').length,
    approved: merchants.filter((m) => m.status === 'approved').length,
    suspended: merchants.filter((m) => m.status === 'suspended').length,
    rejected: merchants.filter((m) => m.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Merchant Management</h1>
          <p className="mt-1 text-slate-500">
            Manage merchant accounts, approvals, and suspensions
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <Filter className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', count: statusCounts.all, color: 'bg-slate-100 text-slate-700' },
          { label: 'Pending', count: statusCounts.pending, color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Active', count: statusCounts.approved, color: 'bg-green-100 text-green-700' },
          { label: 'Suspended', count: statusCounts.suspended, color: 'bg-red-100 text-red-700' },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setStatusFilter(stat.label.toLowerCase())}
            className={`rounded-lg p-4 text-left transition-colors ${stat.color} ${
              statusFilter === stat.label.toLowerCase() ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-sm font-medium">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search merchants by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Merchants Table */}
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead>Merchant</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Campaigns</TableHead>
            <TableHead>Total Spent</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMerchants.map((merchant) => (
            <TableRow key={merchant.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-slate-900">{merchant.name}</p>
                  <p className="text-xs text-slate-500">ID: {merchant.id}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {merchant.email}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {merchant.phone}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={merchant.status} />
              </TableCell>
              <TableCell>
                <p className="font-medium">{merchant.totalCampaigns}</p>
              </TableCell>
              <TableCell>
                <p className="font-medium">{formatCurrency(merchant.totalSpent)}</p>
              </TableCell>
              <TableCell>
                <p className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatDate(merchant.joinedAt)}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openMerchantDetails(merchant)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {merchant.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        isLoading={actionLoading === merchant.id}
                        onClick={() => handleApprove(merchant.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        isLoading={actionLoading === merchant.id}
                        onClick={() => handleReject(merchant.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {merchant.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={actionLoading === merchant.id}
                      onClick={() => handleSuspend(merchant.id)}
                    >
                      <Ban className="h-4 w-4" />
                      Suspend
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Merchant Details Modal */}
      {isModalOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">Merchant Details</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="mt-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600">
                  {selectedMerchant.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedMerchant.name}</h3>
                  <StatusBadge status={selectedMerchant.status} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{selectedMerchant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium">{selectedMerchant.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Joined</p>
                  <p className="font-medium">{formatDate(selectedMerchant.joinedAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Active</p>
                  <p className="font-medium">{formatDate(selectedMerchant.lastActiveAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Campaigns</p>
                  <p className="font-medium">{selectedMerchant.totalCampaigns}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Spent</p>
                  <p className="flex items-center gap-1 font-medium">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(selectedMerchant.totalSpent)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
              {selectedMerchant.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      handleReject(selectedMerchant.id);
                      setIsModalOpen(false);
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => {
                      handleApprove(selectedMerchant.id);
                      setIsModalOpen(false);
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
