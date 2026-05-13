'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Play,
  Pause,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  DollarSign,
  MousePointer,
  Image,
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
import { getCampaigns, pauseCampaign, resumeCampaign } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  merchantId: string;
  merchantName: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'rejected';
  type: 'display' | 'video' | 'native' | 'sponsored';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

// Mock data for demonstration
const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Summer Sale 2026',
    merchantId: '1',
    merchantName: 'Fashion Hub',
    status: 'active',
    type: 'display',
    budget: 15000,
    spent: 8250,
    impressions: 1250000,
    clicks: 42500,
    startDate: '2026-05-01',
    endDate: '2026-06-30',
    createdAt: '2026-04-15',
  },
  {
    id: '2',
    name: 'Tech Launch Campaign',
    merchantId: '2',
    merchantName: 'TechCorp Inc.',
    status: 'active',
    type: 'video',
    budget: 25000,
    spent: 15200,
    impressions: 890000,
    clicks: 31200,
    startDate: '2026-04-20',
    endDate: '2026-07-20',
    createdAt: '2026-04-10',
  },
  {
    id: '3',
    name: 'Weekend Special',
    merchantId: '4',
    merchantName: 'Food Delivery Pro',
    status: 'paused',
    type: 'native',
    budget: 5000,
    spent: 2100,
    impressions: 320000,
    clicks: 12800,
    startDate: '2026-05-05',
    endDate: '2026-05-31',
    createdAt: '2026-05-01',
  },
  {
    id: '4',
    name: 'Auto Show Promo',
    merchantId: '3',
    merchantName: 'AutoDeals',
    status: 'active',
    type: 'display',
    budget: 12000,
    spent: 4800,
    impressions: 560000,
    clicks: 18900,
    startDate: '2026-04-01',
    endDate: '2026-06-01',
    createdAt: '2026-03-25',
  },
  {
    id: '5',
    name: 'Health Awareness',
    merchantId: '6',
    merchantName: 'Health & Wellness Co.',
    status: 'draft',
    type: 'sponsored',
    budget: 8000,
    spent: 0,
    impressions: 0,
    clicks: 0,
    startDate: '2026-06-01',
    endDate: '2026-08-01',
    createdAt: '2026-05-08',
  },
  {
    id: '6',
    name: 'Spring Collection',
    merchantId: '1',
    merchantName: 'Fashion Hub',
    status: 'completed',
    type: 'video',
    budget: 18000,
    spent: 18000,
    impressions: 2100000,
    clicks: 72500,
    startDate: '2026-03-01',
    endDate: '2026-04-30',
    createdAt: '2026-02-20',
  },
  {
    id: '7',
    name: 'Travel Deals May',
    merchantId: '5',
    merchantName: 'TravelBook',
    status: 'active',
    type: 'native',
    budget: 10000,
    spent: 6500,
    impressions: 420000,
    clicks: 15600,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    createdAt: '2026-04-25',
  },
  {
    id: '8',
    name: 'Gaming Tournament',
    merchantId: '8',
    merchantName: 'Gaming Zone',
    status: 'rejected',
    type: 'display',
    budget: 20000,
    spent: 0,
    impressions: 0,
    clicks: 0,
    startDate: '2026-05-15',
    endDate: '2026-07-15',
    createdAt: '2026-05-01',
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCTR(clicks: number, impressions: number): string {
  if (impressions === 0) return '0%';
  return ((clicks / impressions) * 100).toFixed(2) + '%';
}

const campaignTypeIcons: Record<string, React.ReactNode> = {
  display: <Image className="h-4 w-4" />,
  video: <Play className="h-4 w-4" />,
  native: <Edit className="h-4 w-4" />,
  sponsored: <TrendingUp className="h-4 w-4" />,
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await getCampaigns({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          merchantId: undefined,
        });
        if (response.success) {
          setCampaigns(response.data.campaigns);
        }
      } catch {
        setCampaigns(mockCampaigns);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCampaigns();
  }, [statusFilter]);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.merchantName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesType = typeFilter === 'all' || campaign.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await pauseCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'paused' } : c))
      );
    } catch {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'paused' } : c))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await resumeCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'active' } : c))
      );
    } catch {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'active' } : c))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === 'active').length,
    paused: campaigns.filter((c) => c.status === 'paused').length,
    totalSpent: campaigns.reduce((acc, c) => acc + c.spent, 0),
    totalImpressions: campaigns.reduce((acc, c) => acc + c.impressions, 0),
    totalClicks: campaigns.reduce((acc, c) => acc + c.clicks, 0),
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Management</h1>
          <p className="mt-1 text-slate-500">
            Monitor, approve, and manage all advertising campaigns
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <Filter className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-6">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Campaigns</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-4 shadow-sm ring-1 ring-green-200">
          <p className="text-sm text-green-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-4 shadow-sm ring-1 ring-yellow-200">
          <p className="text-sm text-yellow-600">Paused</p>
          <p className="mt-1 text-2xl font-bold text-yellow-700">{stats.paused}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <DollarSign className="h-4 w-4" />
            Total Spent
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(stats.totalSpent)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <Eye className="h-4 w-4" />
            Impressions
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(stats.totalImpressions)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <MousePointer className="h-4 w-4" />
            Clicks
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(stats.totalClicks)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[280px]">
          <Input
            placeholder="Search campaigns or merchants..."
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
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          <option value="all">All Types</option>
          <option value="display">Display</option>
          <option value="video">Video</option>
          <option value="native">Native</option>
          <option value="sponsored">Sponsored</option>
        </select>
      </div>

      {/* Campaigns Table */}
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead>Campaign</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Budget / Spent</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCampaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-slate-900">{campaign.name}</p>
                  <p className="text-xs text-slate-500">ID: {campaign.id}</p>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm text-slate-700">{campaign.merchantName}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 p-1.5 text-slate-600">
                    {campaignTypeIcons[campaign.type]}
                  </span>
                  <span className="text-sm capitalize text-slate-700">{campaign.type}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{formatCurrency(campaign.spent)}</p>
                  <p className="text-xs text-slate-500">
                    of {formatCurrency(campaign.budget)}
                  </p>
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    <Eye className="mr-1 inline h-3 w-3" />
                    {formatNumber(campaign.impressions)}
                  </p>
                  <p className="text-xs text-slate-500">
                    <MousePointer className="mr-1 inline h-3 w-3" />
                    {formatNumber(campaign.clicks)}
                  </p>
                  <p className="text-xs font-medium text-primary-600">
                    CTR: {getCTR(campaign.clicks, campaign.impressions)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3 w-3" />
                  {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {campaign.status === 'active' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={actionLoading === campaign.id}
                      onClick={() => handlePause(campaign.id)}
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  {campaign.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="success"
                      isLoading={actionLoading === campaign.id}
                      onClick={() => handleResume(campaign.id)}
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
