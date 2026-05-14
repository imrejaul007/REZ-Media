'use client';

import { useEffect, useState } from 'react';
import { getAnalytics, getPayouts, Analytics, Payout } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Megaphone,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type DateRange = '7d' | '30d' | '90d' | '1y';
type PayoutStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [payoutFilter, setPayoutFilter] = useState<PayoutStatus>('all');
  const [showPayouts, setShowPayouts] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsData, payoutsData] = await Promise.all([
          getAnalytics(),
          getPayouts(),
        ]);
        setAnalytics(analyticsData);
        setPayouts(payoutsData);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPayoutStatusBadge = (status: Payout['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    const icons = {
      pending: <Clock className="w-3.5 h-3.5" />,
      processing: <AlertCircle className="w-3.5 h-3.5" />,
      completed: <CheckCircle className="w-3.5 h-3.5" />,
      failed: <XCircle className="w-3.5 h-3.5" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const filteredPayouts = payouts.filter((payout) =>
    payoutFilter === 'all' || payout.status === payoutFilter
  );

  const totalPendingPayouts = payouts
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCompletedPayouts = payouts
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pieData = [
    { name: 'Fashion', value: 35, color: '#ec4899' },
    { name: 'Technology', value: 28, color: '#3b82f6' },
    { name: 'Beauty', value: 18, color: '#a855f7' },
    { name: 'Fitness', value: 12, color: '#22c55e' },
    { name: 'Other', value: 7, color: '#6b7280' },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="text-gray-500 mt-1">Track your referral performance</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const stats = [
    {
      label: 'Total Referrals',
      value: formatNumber(analytics.totalReferrals),
      change: '+12.5%',
      positive: true,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(analytics.totalRevenue),
      change: '+8.2%',
      positive: true,
      icon: DollarSign,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Conversion Rate',
      value: `${analytics.conversionRate}%`,
      change: '+0.5%',
      positive: true,
      icon: Target,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Avg Commission',
      value: formatCurrency(analytics.avgCommission),
      change: '-2.1%',
      positive: false,
      icon: Wallet,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your referral performance and payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Revenue Trend</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-500" />
                <span className="text-sm text-gray-500">Revenue</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyData}>
                <defs>
                  <linearGradient id="colorRevenueAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenueAnalytics)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="section-title mb-6">Category Distribution</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Referrals Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Referrals & Conversions</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="referrals" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Referrals" />
                <Bar dataKey="conversions" fill="#22c55e" radius={[4, 4, 0, 0]} name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-500" />
              <span className="text-sm text-gray-600">Referrals</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Conversions</span>
            </div>
          </div>
        </div>

        {/* Top Campaigns Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Top Campaigns</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topCampaigns} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={120}
                  tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : name === 'referrals' ? 'Referrals' : 'Conversion %'
                  ]}
                />
                <Bar dataKey="revenue" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payout Management */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="section-title">Payout Management</h2>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-gray-500">Pending: <span className="font-medium text-yellow-600">{formatCurrency(totalPendingPayouts)}</span></span>
              <span className="text-gray-500">Completed: <span className="font-medium text-green-600">{formatCurrency(totalCompletedPayouts)}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'pending', 'processing', 'completed', 'failed'] as PayoutStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setPayoutFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    payoutFilter === status
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Campaign</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="font-medium">{payout.creatorName}</td>
                  <td className="text-gray-500">{payout.campaignName}</td>
                  <td className="font-medium text-green-600">{formatCurrency(payout.amount)}</td>
                  <td>{getPayoutStatusBadge(payout.status)}</td>
                  <td className="text-gray-500">
                    {format(parseISO(payout.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td>
                    {(payout.status === 'pending' || payout.status === 'processing') && (
                      <button className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                        Process
                      </button>
                    )}
                    {payout.status === 'completed' && (
                      <span className="text-sm text-gray-400">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPayouts.length === 0 && (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payouts found</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="section-title mb-4">Recent Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.recentActivity.slice(0, 6).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                {activity.type === 'referral' && <Users className="w-5 h-5 text-brand-600" />}
                {activity.type === 'payout' && <DollarSign className="w-5 h-5 text-green-600" />}
                {activity.type === 'signup' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                {activity.type === 'campaign_created' && <Megaphone className="w-5 h-5 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(parseISO(activity.timestamp), 'MMM d, h:mm a')}
                </p>
              </div>
              {activity.amount && (
                <span className="text-sm font-medium text-green-600">
                  +{formatCurrency(activity.amount)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
