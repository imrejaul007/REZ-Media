'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnalytics, getPayouts, Analytics, Payout } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Megaphone,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error('Failed to load dashboard data:', error);
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

  const getPayoutStatusIcon = (status: Payout['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back! Here is your overview.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      label: 'Active Campaigns',
      value: analytics.activeCampaigns.toString(),
      change: '+3',
      positive: true,
      icon: Megaphone,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Conversion Rate',
      value: `${analytics.conversionRate}%`,
      change: '+0.5%',
      positive: true,
      icon: Target,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here is your referral overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Create Campaign
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Revenue Overview</h2>
            <select className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option>Last 6 months</option>
              <option>Last year</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Referrals Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Referrals by Month</h2>
            <select className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option>Last 6 months</option>
              <option>Last year</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [value.toLocaleString(), 'Referrals']}
                />
                <Bar dataKey="referrals" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Creators */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Creators</h2>
            <Link href="/creators" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {analytics.topCreators.map((creator, index) => (
              <div key={creator.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{creator.name}</p>
                  <p className="text-xs text-gray-500">{creator.referrals.toLocaleString()} referrals</p>
                </div>
                <p className="text-sm font-medium text-green-600">{formatCurrency(creator.earnings)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Campaigns</h2>
            <Link href="/campaigns" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {analytics.topCampaigns.map((campaign, index) => (
              <div key={campaign.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{campaign.name}</p>
                  <p className="text-xs text-gray-500">{campaign.referrals.toLocaleString()} referrals</p>
                </div>
                <p className="text-sm font-medium text-gray-700">{campaign.conversionRate}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payouts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Payouts</h2>
            <Link href="/analytics" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {payouts.slice(0, 4).map((payout) => (
              <div key={payout.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  {getPayoutStatusIcon(payout.status)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{payout.creatorName}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{payout.campaignName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(payout.amount)}</p>
                  <p className="text-xs text-gray-500 capitalize">{payout.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="section-title mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {analytics.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                {activity.type === 'referral' && <Users className="w-5 h-5 text-brand-600" />}
                {activity.type === 'payout' && <DollarSign className="w-5 h-5 text-green-600" />}
                {activity.type === 'signup' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                {activity.type === 'campaign_created' && <Megaphone className="w-5 h-5 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(parseISO(activity.timestamp), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              {activity.amount && (
                <span className="text-sm font-medium text-green-600">+{formatCurrency(activity.amount)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
