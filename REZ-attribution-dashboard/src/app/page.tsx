'use client';

import React from 'react';
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Eye,
  MousePointer,
  ShoppingCart,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Mock data for the dashboard
const conversionTrendData = [
  { date: 'May 1', conversions: 245, touchpoints: 1820 },
  { date: 'May 2', conversions: 312, touchpoints: 2100 },
  { date: 'May 3', conversions: 278, touchpoints: 1950 },
  { date: 'May 4', conversions: 356, touchpoints: 2400 },
  { date: 'May 5', conversions: 389, touchpoints: 2650 },
  { date: 'May 6', conversions: 423, touchpoints: 2890 },
  { date: 'May 7', conversions: 398, touchpoints: 2750 },
  { date: 'May 8', conversions: 445, touchpoints: 3100 },
  { date: 'May 9', conversions: 467, touchpoints: 3250 },
  { date: 'May 10', conversions: 512, touchpoints: 3580 },
  { date: 'May 11', conversions: 489, touchpoints: 3420 },
  { date: 'May 12', conversions: 534, touchpoints: 3750 },
];

const channelData = [
  { channel: 'Paid Search', spend: 45000, conversions: 1234, roi: 285 },
  { channel: 'Social Media', spend: 32000, conversions: 892, roi: 178 },
  { channel: 'Email', spend: 12000, conversions: 2341, roi: 412 },
  { channel: 'Display', spend: 28000, conversions: 456, roi: 89 },
  { channel: 'Organic', spend: 8000, conversions: 1876, roi: 534 },
  { channel: 'Referral', spend: 15000, conversions: 967, roi: 321 },
];

const attributionData = [
  { name: 'First Touch', value: 28, color: '#0ea5e9' },
  { name: 'Last Touch', value: 35, color: '#8b5cf6' },
  { name: 'Linear', value: 22, color: '#22c55e' },
  { name: 'Time Decay', value: 15, color: '#f59e0b' },
];

const funnelData = [
  { stage: 'Impressions', count: 125000, dropoff: 0 },
  { stage: 'Clicks', count: 8750, dropoff: 93 },
  { stage: 'Landing Page', count: 6230, dropoff: 29 },
  { stage: 'Add to Cart', count: 2890, dropoff: 54 },
  { stage: 'Checkout', count: 1567, dropoff: 46 },
  { stage: 'Conversion', count: 892, dropoff: 43 },
];

const topCampaigns = [
  {
    id: 1,
    name: 'Spring Sale 2024',
    channel: 'Paid Search',
    spend: 15000,
    conversions: 456,
    revenue: 68400,
    roi: 356,
    status: 'active',
  },
  {
    id: 2,
    name: 'Brand Awareness Q2',
    channel: 'Social Media',
    spend: 22000,
    conversions: 1234,
    revenue: 92550,
    roi: 321,
    status: 'active',
  },
  {
    id: 3,
    name: 'Newsletter Promo',
    channel: 'Email',
    spend: 5000,
    conversions: 2341,
    revenue: 117050,
    roi: 2241,
    status: 'active',
  },
  {
    id: 4,
    name: 'Retargeting Campaign',
    channel: 'Display',
    spend: 18000,
    conversions: 678,
    revenue: 50850,
    roi: 183,
    status: 'active',
  },
  {
    id: 5,
    name: 'Influencer Collab',
    channel: 'Social Media',
    spend: 25000,
    conversions: 567,
    revenue: 42525,
    roi: 70,
    status: 'paused',
  },
];

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-brand-600" />
        </div>
      </div>
      <div className="flex items-center mt-4">
        {changeType === 'positive' ? (
          <ArrowUpRight className="h-4 w-4 text-success-500 mr-1" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-danger-500 mr-1" />
        )}
        <span
          className={`text-sm font-medium ${
            changeType === 'positive' ? 'text-success-600' : 'text-danger-600'
          }`}
        >
          {change}
        </span>
        <span className="text-sm text-slate-400 ml-1">vs last month</span>
      </div>
    </div>
  );
}

// Custom tooltip for charts
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
            <span className="font-medium">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const totalRevenue = channelData.reduce((acc, ch) => acc + ch.conversions * 55, 0);
  const totalSpend = channelData.reduce((acc, ch) => acc + ch.spend, 0);
  const overallROI = Math.round(((totalRevenue - totalSpend) / totalSpend) * 100);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Touchpoints"
          value="12,847"
          change="12.5%"
          changeType="positive"
          icon={MousePointer}
        />
        <MetricCard
          title="Conversions"
          value="8,766"
          change="8.3%"
          changeType="positive"
          icon={Target}
        />
        <MetricCard
          title="Conversion Rate"
          value="4.23%"
          change="0.3%"
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Revenue"
          value={`$${(totalRevenue / 1000).toFixed(1)}K`}
          change="15.2%"
          changeType="positive"
          icon={DollarSign}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Conversion Trend
              </h3>
              <p className="text-sm text-slate-500">Last 12 days performance</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Calendar className="h-4 w-4" />
                Last 12 days
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionTrendData}>
                <defs>
                  <linearGradient id="colorTouchpoints" x1="0" y1="0" x2="0" y2="1">
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
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="touchpoints"
                  name="Touchpoints"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTouchpoints)"
                />
                <Area
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorConversions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-brand-500" />
              <span className="text-sm text-slate-600">Touchpoints</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success-500" />
              <span className="text-sm text-slate-600">Conversions</span>
            </div>
          </div>
        </div>

        {/* Attribution Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Attribution Model Breakdown
              </h3>
              <p className="text-sm text-slate-500">Conversion attribution by model</p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
          <div className="h-72 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {attributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {attributionData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-slate-600">{item.name}</span>
                <span className="text-sm font-medium text-slate-900 ml-auto">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channel ROI and Funnel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel ROI */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Channel ROI</h3>
              <p className="text-sm text-slate-500">
                Return on investment by marketing channel
              </p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis
                  dataKey="channel"
                  type="category"
                  stroke="#64748b"
                  fontSize={12}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="roi" name="ROI %" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Preview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Funnel</h3>
              <p className="text-sm text-slate-500">Conversion funnel stages</p>
            </div>
            <a
              href="/campaigns"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              View details
            </a>
          </div>
          <div className="space-y-3">
            {funnelData.map((stage, index) => {
              const widthPercent = (stage.count / funnelData[0].count) * 100;
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">
                      {stage.stage}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-md transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  {stage.dropoff > 0 && (
                    <p className="text-xs text-danger-500 mt-1">
                      -{stage.dropoff}% drop-off
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Top Campaigns</h3>
              <p className="text-sm text-slate-500">
                Best performing campaigns this period
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Filter className="h-4 w-4" />
                Filter
              </button>
              <a
                href="/campaigns"
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
              >
                View All
              </a>
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
                  Channel
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Spend
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Conversions
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ROI
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">
                      {campaign.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{campaign.channel}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${campaign.spend.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      {campaign.conversions.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${campaign.revenue.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-semibold ${
                        campaign.roi > 200
                          ? 'text-success-600'
                          : campaign.roi > 100
                          ? 'text-brand-600'
                          : 'text-warning-600'
                      }`}
                    >
                      {campaign.roi > 100 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {campaign.roi}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        campaign.status === 'active'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
