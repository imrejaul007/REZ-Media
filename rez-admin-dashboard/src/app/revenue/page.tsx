'use client';

import { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import Button from '@/components/Button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { getRevenueStats, getRevenueByMerchant, getRevenueByCampaignType } from '@/lib/api';

interface RevenueData {
  date: string;
  revenue: number;
  impressions: number;
  clicks: number;
}

interface MerchantRevenue {
  merchantId: string;
  name: string;
  revenue: number;
}

interface TypeRevenue {
  type: string;
  revenue: number;
}

// Mock data for demonstration
const mockRevenueData: RevenueData[] = [
  { date: 'May 1', revenue: 8500, impressions: 145000, clicks: 4200 },
  { date: 'May 2', revenue: 9200, impressions: 152000, clicks: 4500 },
  { date: 'May 3', revenue: 7800, impressions: 128000, clicks: 3800 },
  { date: 'May 4', revenue: 10200, impressions: 168000, clicks: 5100 },
  { date: 'May 5', revenue: 11500, impressions: 185000, clicks: 5600 },
  { date: 'May 6', revenue: 9800, impressions: 162000, clicks: 4900 },
  { date: 'May 7', revenue: 12400, impressions: 198000, clicks: 6200 },
  { date: 'May 8', revenue: 13200, impressions: 210000, clicks: 6800 },
  { date: 'May 9', revenue: 11800, impressions: 192000, clicks: 5900 },
  { date: 'May 10', revenue: 14500, impressions: 225000, clicks: 7200 },
  { date: 'May 11', revenue: 15200, impressions: 238000, clicks: 7600 },
  { date: 'May 12', revenue: 13800, impressions: 215000, clicks: 6900 },
];

const mockMerchantRevenue: MerchantRevenue[] = [
  { merchantId: '1', name: 'TechCorp Inc.', revenue: 42500 },
  { merchantId: '2', name: 'Fashion Hub', revenue: 38200 },
  { merchantId: '3', name: 'AutoDeals', revenue: 29800 },
  { merchantId: '4', name: 'Food Delivery Pro', revenue: 24100 },
  { merchantId: '5', name: 'TravelBook', revenue: 18500 },
  { merchantId: '6', name: 'Health & Wellness', revenue: 14200 },
  { merchantId: '7', name: 'EduLearn Platform', revenue: 11800 },
  { merchantId: '8', name: 'Others', revenue: 24650 },
  { merchantId: '9', name: 'Gaming Zone', revenue: 8900 },
  { merchantId: '10', name: 'Home Decor Inc.', revenue: 7250 },
];

const mockTypeRevenue: TypeRevenue[] = [
  { type: 'Display', revenue: 125000 },
  { type: 'Video', revenue: 89000 },
  { type: 'Native', revenue: 52000 },
  { type: 'Sponsored', revenue: 38000 },
];

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

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

export default function RevenuePage() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [merchantRevenue, setMerchantRevenue] = useState<MerchantRevenue[]>([]);
  const [typeRevenue, setTypeRevenue] = useState<TypeRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, merchantRes, typeRes] = await Promise.all([
          getRevenueStats({ groupBy: 'day' }),
          getRevenueByMerchant(),
          getRevenueByCampaignType(),
        ]);
        if (statsRes.success) setRevenueData(statsRes.data.data);
        if (merchantRes.success) setMerchantRevenue(merchantRes.data);
        if (typeRes.success) setTypeRevenue(typeRes.data);
      } catch {
        setRevenueData(mockRevenueData);
        setMerchantRevenue(mockMerchantRevenue);
        setTypeRevenue(mockTypeRevenue);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalRevenue = revenueData.reduce((acc, d) => acc + d.revenue, 0);
  const totalImpressions = revenueData.reduce((acc, d) => acc + d.impressions, 0);
  const totalClicks = revenueData.reduce((acc, d) => acc + d.clicks, 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'revenue' ? 'Revenue: ' : `${entry.name}: `}
              {entry.name === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Revenue Analytics</h1>
          <p className="mt-1 text-slate-500">
            Track platform revenue, campaign performance, and merchant earnings
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
          </select>
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          change={12.5}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatsCard
          title="Total Impressions"
          value={formatNumber(totalImpressions)}
          change={8.3}
          icon={<Eye className="h-6 w-6" />}
        />
        <StatsCard
          title="Total Clicks"
          value={formatNumber(totalClicks)}
          change={15.2}
          icon={<MousePointer className="h-6 w-6" />}
        />
        <StatsCard
          title="Average CTR"
          value={avgCTR + '%'}
          change={2.1}
          icon={<TrendingUp className="h-6 w-6" />}
        />
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Revenue Over Time</h2>
            <p className="text-sm text-slate-500">Daily revenue trends</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary-500" />
              <span className="text-sm text-slate-600">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm text-slate-600">Impressions</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis
                yAxisId="left"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="revenue"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="impressions"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorImpressions)"
                name="impressions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue by Merchant */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Merchant</h2>
          <p className="text-sm text-slate-500">Top merchants by revenue</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={merchantRevenue}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {merchantRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Campaign Type */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Campaign Type</h2>
          <p className="text-sm text-slate-500">Revenue distribution by ad type</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${value / 1000}k`}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  stroke="#94a3b8"
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {typeRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Merchants Table */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Top Merchants by Revenue</h2>
        <div className="mt-6 space-y-4">
          {merchantRevenue.slice(0, 5).map((merchant, index) => (
            <div key={merchant.merchantId} className="flex items-center gap-4">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : index === 1
                      ? 'bg-slate-200 text-slate-600'
                      : index === 2
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-50 text-slate-500'
                }`}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{merchant.name}</p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(merchant.revenue / merchantRevenue[0].revenue) * 100}%`,
                      backgroundColor: COLORS[index],
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">{formatCurrency(merchant.revenue)}</p>
                <p className="text-xs text-slate-500">
                  {((merchant.revenue / totalRevenue) * 100).toFixed(1)}% of total
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
