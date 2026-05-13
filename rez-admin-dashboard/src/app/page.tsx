'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Megaphone,
  DollarSign,
  Eye,
  MousePointer,
  TrendingUp,
  Clock,
} from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import { getDashboardStats } from '@/lib/api';

interface DashboardStats {
  totalMerchants: number;
  activeMerchants: number;
  pendingMerchants: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalRevenue: number;
  revenueChange: number;
  totalImpressions: number;
  impressionsChange: number;
  totalClicks: number;
  clicksChange: number;
}

// Mock data for demonstration
const mockStats: DashboardStats = {
  totalMerchants: 156,
  activeMerchants: 128,
  pendingMerchants: 12,
  totalCampaigns: 342,
  activeCampaigns: 89,
  totalRevenue: 284750,
  revenueChange: 12.5,
  totalImpressions: 4520000,
  impressionsChange: 8.3,
  totalClicks: 124500,
  clicksChange: 15.2,
};

const recentActivity = [
  { id: 1, action: 'New merchant approved', merchant: 'TechCorp Inc.', time: '5 minutes ago', type: 'merchant' },
  { id: 2, action: 'Campaign activated', merchant: 'Fashion Hub', campaign: 'Summer Sale 2026', time: '12 minutes ago', type: 'campaign' },
  { id: 3, action: 'Payment received', amount: 2500, merchant: 'AutoDeals', time: '25 minutes ago', type: 'payment' },
  { id: 4, action: 'Campaign paused', merchant: 'Food Delivery Pro', campaign: 'Weekend Special', time: '45 minutes ago', type: 'campaign' },
  { id: 5, action: 'New merchant registered', merchant: 'Health & Wellness Co.', time: '1 hour ago', type: 'merchant' },
];

const topPerformers = [
  { rank: 1, name: 'TechCorp Inc.', campaigns: 12, revenue: 42500 },
  { rank: 2, name: 'Fashion Hub', campaigns: 8, revenue: 38200 },
  { rank: 3, name: 'AutoDeals', campaigns: 6, revenue: 29800 },
  { rank: 4, name: 'Food Delivery Pro', campaigns: 10, revenue: 24100 },
  { rank: 5, name: 'TravelBook', campaigns: 5, revenue: 18500 },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await getDashboardStats();
        if (response.success) {
          setStats(response.data);
        }
      } catch {
        // Use mock data when API is not available
        setStats(mockStats);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const displayStats = stats || mockStats;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="mt-1 text-slate-500">
          Monitor your platform performance and key metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Merchants"
          value={displayStats.totalMerchants}
          change={8.2}
          icon={<Users className="h-6 w-6" />}
        />
        <StatsCard
          title="Active Campaigns"
          value={displayStats.activeCampaigns}
          change={5.4}
          icon={<Megaphone className="h-6 w-6" />}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(displayStats.totalRevenue)}
          change={displayStats.revenueChange}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatsCard
          title="Total Impressions"
          value={formatNumber(displayStats.totalImpressions)}
          change={displayStats.impressionsChange}
          icon={<Eye className="h-6 w-6" />}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Click Performance */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Click Performance</h2>
            <MousePointer className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900">
                {formatNumber(displayStats.totalClicks)}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4" />
                +{displayStats.clicksChange}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Total clicks this month</p>
          </div>
          <div className="mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: '72%' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>CTR: 2.75%</span>
              <span>Target: 3.5%</span>
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Pending Actions</h2>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900">
                {displayStats.pendingMerchants}
              </span>
              <span className="text-sm font-medium text-yellow-600">
                merchants awaiting review
              </span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-yellow-50 px-4 py-2">
              <span className="text-sm font-medium text-slate-700">Merchant Applications</span>
              <span className="text-sm font-semibold text-yellow-600">
                {displayStats.pendingMerchants}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2">
              <span className="text-sm font-medium text-slate-700">Campaign Reviews</span>
              <span className="text-sm font-semibold text-blue-600">8</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
              <span className="text-sm font-medium text-slate-700">Dispute Tickets</span>
              <span className="text-sm font-semibold text-slate-600">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity and Top Performers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div
                  className={`mt-1 h-2 w-2 rounded-full ${
                    activity.type === 'merchant'
                      ? 'bg-blue-500'
                      : activity.type === 'campaign'
                        ? 'bg-green-500'
                        : 'bg-yellow-500'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                  <p className="text-xs text-slate-500">
                    {'merchant' in activity && activity.merchant}
                    {'campaign' in activity && ` - ${activity.campaign}`}
                    {'amount' in activity && ` - ${formatCurrency(activity.amount as number)}`}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Top Performers</h2>
          <div className="mt-4 space-y-3">
            {topPerformers.map((performer) => (
              <div
                key={performer.rank}
                className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      performer.rank === 1
                        ? 'bg-yellow-100 text-yellow-700'
                        : performer.rank === 2
                          ? 'bg-slate-200 text-slate-600'
                          : performer.rank === 3
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {performer.rank}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{performer.name}</p>
                    <p className="text-xs text-slate-500">
                      {performer.campaigns} active campaigns
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(performer.revenue)}
                  </p>
                  <p className="text-xs text-slate-500">revenue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
