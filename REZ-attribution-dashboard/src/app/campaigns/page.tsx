'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  FunnelChart as RechartsFunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Search,
  Plus,
  ChevronDown,
  Eye,
  MousePointer,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  BarChart3,
} from 'lucide-react';

// Campaign data
const campaigns = [
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
  {
    id: 6,
    name: 'Summer Preview',
    channel: 'Paid Search',
    status: 'active',
    startDate: '2024-05-01',
    endDate: '2024-08-31',
    budget: 35000,
    spent: 8900,
    impressions: 178000,
    clicks: 14200,
    conversions: 389,
    revenue: 58400,
    ctr: 7.98,
    cpc: 0.63,
    cpa: 22.88,
    roas: 6.56,
  },
];

// Funnel data for detailed view
const funnelDetailData = [
  { stage: 'Impressions', count: 125000, fill: '#0ea5e9' },
  { stage: 'Clicks', count: 8750, fill: '#06b6d4' },
  { stage: 'Landing Page Views', count: 6230, fill: '#22c55e' },
  { stage: 'Add to Cart', count: 2890, fill: '#84cc16' },
  { stage: 'Checkout Started', count: 1567, fill: '#eab308' },
  { stage: 'Purchase', count: 892, fill: '#f97316' },
];

// Daily trend data
const dailyTrendData = [
  { date: 'May 1', spend: 1200, conversions: 45, revenue: 6750 },
  { date: 'May 2', spend: 1350, conversions: 52, revenue: 7800 },
  { date: 'May 3', spend: 1100, conversions: 38, revenue: 5700 },
  { date: 'May 4', spend: 1500, conversions: 61, revenue: 9150 },
  { date: 'May 5', spend: 1680, conversions: 72, revenue: 10800 },
  { date: 'May 6', spend: 1420, conversions: 55, revenue: 8250 },
  { date: 'May 7', spend: 1550, conversions: 68, revenue: 10200 },
  { date: 'May 8', spend: 1720, conversions: 78, revenue: 11700 },
  { date: 'May 9', spend: 1680, conversions: 74, revenue: 11100 },
  { date: 'May 10', spend: 1890, conversions: 89, revenue: 13350 },
  { date: 'May 11', spend: 1750, conversions: 82, revenue: 12300 },
  { date: 'May 12', spend: 1920, conversions: 94, revenue: 14100 },
];

// Channel breakdown
const channelBreakdown = [
  { channel: 'Paid Search', spend: 21250, conversions: 845, revenue: 126800, roi: 497 },
  { channel: 'Social Media', spend: 27000, conversions: 1801, revenue: 135075, roi: 400 },
  { channel: 'Email', spend: 4200, conversions: 2341, revenue: 117050, roi: 2687 },
  { channel: 'Display', spend: 16200, conversions: 678, revenue: 50850, roi: 214 },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-slate-600">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            <span className="font-medium">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function CampaignsPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || campaign.channel === channelFilter;
    return matchesSearch && matchesStatus && matchesChannel;
  });

  const totalMetrics = campaigns.reduce(
    (acc, campaign) => ({
      spend: acc.spend + campaign.spent,
      conversions: acc.conversions + campaign.conversions,
      revenue: acc.revenue + campaign.revenue,
    }),
    { spend: 0, conversions: 0, revenue: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Campaign Attribution</h2>
          <p className="text-slate-500 mt-1">
            Analyze campaign performance and attribution across channels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Campaigns</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{campaigns.length}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-brand-600" />
            </div>
          </div>
          <p className="text-sm text-success-600 mt-3 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            2 new this month
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Spend</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                ${totalMetrics.spend.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-warning-50 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-warning-600" />
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-3">of $95,000 budget</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Conversions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {totalMetrics.conversions.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-success-50 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
          </div>
          <p className="text-sm text-success-600 mt-3 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            +18.5% vs last month
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                ${totalMetrics.revenue.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-brand-600" />
            </div>
          </div>
          <p className="text-sm text-success-600 mt-3 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            +22.3% vs last month
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Daily Performance</h3>
              <p className="text-sm text-slate-500">Spend and conversions over time</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-brand-500" />
                <span className="text-sm text-slate-600">Spend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success-500" />
                <span className="text-sm text-slate-600">Conversions</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  name="Spend"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#colorSpend)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#colorConversions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Conversion Funnel</h3>
              <p className="text-sm text-slate-500">User journey stages</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsFunnelChart>
                <Funnel
                  dataKey="count"
                  data={funnelDetailData}
                  isAnimationActive
                >
                  <LabelList
                    position="right"
                    fill="#475569"
                    stroke="none"
                    dataKey="stage"
                    formatter={(val: string) => [val]}
                  />
                  <LabelList
                    position="center"
                    fill="#fff"
                    stroke="none"
                    dataKey="count"
                    formatter={(val: number) => val.toLocaleString()}
                  />
                </Funnel>
                <Tooltip />
              </RechartsFunnelChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Channel Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Channel Performance</h3>
            <p className="text-sm text-slate-500">ROI breakdown by marketing channel</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="channel" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="roi" name="ROI %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaign Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">All Campaigns</h3>
              <p className="text-sm text-slate-500">
                {filteredCampaigns.length} campaigns found
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 h-10 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Channels</option>
                <option value="Paid Search">Paid Search</option>
                <option value="Social Media">Social Media</option>
                <option value="Email">Email</option>
                <option value="Display">Display</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Spent
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CTR
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CPA
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Conversions
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ROAS
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() =>
                    setSelectedCampaign(
                      selectedCampaign === campaign.id ? null : campaign.id
                    )
                  }
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
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        campaign.status === 'active'
                          ? 'bg-success-100 text-success-700'
                          : campaign.status === 'paused'
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm text-slate-600">
                      ${campaign.budget.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div>
                      <span className="text-sm font-medium text-slate-900">
                        ${campaign.spent.toLocaleString()}
                      </span>
                      <p className="text-xs text-slate-500">
                        {((campaign.spent / campaign.budget) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      {campaign.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${campaign.cpa.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      {campaign.conversions.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-semibold ${
                        campaign.roas > 5
                          ? 'text-success-600'
                          : campaign.roas > 3
                          ? 'text-brand-600'
                          : 'text-warning-600'
                      }`}
                    >
                      {campaign.roas > 5 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {campaign.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${campaign.revenue.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCampaigns.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-500">No campaigns found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
