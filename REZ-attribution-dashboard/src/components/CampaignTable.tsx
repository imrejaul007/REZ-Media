'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Pause,
  Play,
} from 'lucide-react';

export interface Campaign {
  id: number | string;
  name: string;
  channel: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
}

interface CampaignTableProps {
  campaigns: Campaign[];
  title?: string;
  subtitle?: string;
  onCampaignClick?: (campaign: Campaign) => void;
  showPagination?: boolean;
  pageSize?: number;
}

type SortField = keyof Campaign;
type SortDirection = 'asc' | 'desc';

export default function CampaignTable({
  campaigns,
  title = 'Campaigns',
  subtitle,
  onCampaignClick,
  showPagination = true,
  pageSize = 10,
}: CampaignTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCampaign, setSelectedCampaign] = useState<string | number | null>(null);

  // Get unique channels for filter
  const uniqueChannels = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.channel))),
    [campaigns]
  );

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((campaign) => {
        const matchesSearch = campaign.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || campaign.status === statusFilter;
        const matchesChannel =
          channelFilter === 'all' || campaign.channel === channelFilter;
        return matchesSearch && matchesStatus && matchesChannel;
      })
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
  }, [campaigns, searchTerm, statusFilter, channelFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = showPagination
    ? filteredCampaigns.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      )
    : filteredCampaigns;

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get status badge styles
  const getStatusStyles = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-success-100 text-success-700';
      case 'paused':
        return 'bg-warning-100 text-warning-700';
      case 'completed':
        return 'bg-slate-100 text-slate-600';
      case 'draft':
        return 'bg-slate-100 text-slate-500';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronDown className="h-4 w-4 text-slate-300" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-brand-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-brand-600" />
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
            <p className="text-sm text-slate-500 mt-1">
              {filteredCampaigns.length} campaigns found
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 h-10 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>

            {/* Channel Filter */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Channels</option>
              {uniqueChannels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>

            {/* Export Button */}
            <button className="flex items-center gap-2 px-4 py-2 h-10 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700"
                >
                  Campaign
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </span>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('budget')}
                  className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 w-full"
                >
                  Budget
                  <SortIcon field="budget" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('spent')}
                  className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 w-full"
                >
                  Spent
                  <SortIcon field="spent" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('conversions')}
                  className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 w-full"
                >
                  Conv.
                  <SortIcon field="conversions" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('revenue')}
                  className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 w-full"
                >
                  Revenue
                  <SortIcon field="revenue" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ROAS
                </span>
              </th>
              <th className="px-6 py-3 text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedCampaigns.map((campaign) => (
              <tr
                key={campaign.id}
                className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                  selectedCampaign === campaign.id ? 'bg-brand-50' : ''
                }`}
                onClick={() => {
                  setSelectedCampaign(campaign.id);
                  onCampaignClick?.(campaign);
                }}
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-slate-500">{campaign.channel}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyles(
                      campaign.status
                    )}`}
                  >
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-slate-600">
                    {formatCurrency(campaign.budget)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrency(campaign.spent)}
                    </span>
                    <p className="text-xs text-slate-500">
                      {((campaign.spent / campaign.budget) * 100).toFixed(0)}%
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-slate-900">
                    {campaign.conversions.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-slate-900">
                    {formatCurrency(campaign.revenue)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {campaign.roas !== undefined && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-sm font-semibold ${
                        campaign.roas >= 5
                          ? 'text-success-600 bg-success-50'
                          : campaign.roas >= 3
                          ? 'text-brand-600 bg-brand-50'
                          : 'text-warning-600 bg-warning-50'
                      }`}
                    >
                      {campaign.roas.toFixed(2)}x
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCampaignClick?.(campaign);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {paginatedCampaigns.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-slate-500">No campaigns found matching your criteria</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setChannelFilter('all');
            }}
            className="mt-4 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredCampaigns.length)} of{' '}
            {filteredCampaigns.length} campaigns
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (page) =>
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
              )
              .map((page, index, array) => (
                <React.Fragment key={page}>
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="px-2 text-slate-400">...</span>
                  )}
                  <button
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Example usage data
export const sampleCampaigns: Campaign[] = [
  {
    id: 1,
    name: 'Spring Sale 2024',
    channel: 'Paid Search',
    status: 'active',
    startDate: '2024-04-01',
    endDate: '2024-05-31',
    budget: 15000,
    spent: 12350,
    impressions: 245000,
    clicks: 18200,
    conversions: 456,
    revenue: 68400,
    ctr: 7.43,
    cpc: 0.68,
    cpa: 27.08,
    roas: 5.54,
  },
  {
    id: 2,
    name: 'Brand Awareness Q2',
    channel: 'Social Media',
    status: 'active',
    startDate: '2024-04-15',
    endDate: '2024-06-30',
    budget: 22000,
    spent: 18500,
    impressions: 1250000,
    clicks: 87500,
    conversions: 1234,
    revenue: 92550,
    ctr: 7.0,
    cpc: 0.21,
    cpa: 14.99,
    roas: 5.0,
  },
  {
    id: 3,
    name: 'Newsletter Promo',
    channel: 'Email',
    status: 'active',
    startDate: '2024-03-01',
    endDate: '2024-05-31',
    budget: 5000,
    spent: 4200,
    impressions: 85000,
    clicks: 25500,
    conversions: 2341,
    revenue: 117050,
    ctr: 30.0,
    cpc: 0.16,
    cpa: 1.79,
    roas: 27.87,
  },
  {
    id: 4,
    name: 'Retargeting Campaign',
    channel: 'Display',
    status: 'active',
    startDate: '2024-04-01',
    endDate: '2024-05-31',
    budget: 18000,
    spent: 16200,
    impressions: 890000,
    clicks: 13400,
    conversions: 678,
    revenue: 50850,
    ctr: 1.51,
    cpc: 1.21,
    cpa: 23.89,
    roas: 3.14,
  },
  {
    id: 5,
    name: 'Influencer Collab',
    channel: 'Social Media',
    status: 'paused',
    startDate: '2024-04-20',
    endDate: '2024-05-20',
    budget: 25000,
    spent: 8500,
    impressions: 456000,
    clicks: 22800,
    conversions: 567,
    revenue: 42525,
    ctr: 5.0,
    cpc: 0.37,
    cpa: 14.99,
    roas: 5.0,
  },
];
