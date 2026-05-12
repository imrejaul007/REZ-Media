'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface ChannelROI {
  channel: string;
  spend: number;
  conversions: number;
  revenue: number;
  roi: number;
}

interface ROICardProps {
  title?: string;
  subtitle?: string;
  totalSpend: number;
  totalRevenue: number;
  totalConversions: number;
  overallROI: number;
  channelData: ChannelROI[];
  period?: string;
}

export default function ROICard({
  title = 'Channel ROI',
  subtitle,
  totalSpend,
  totalRevenue,
  totalConversions,
  overallROI,
  channelData,
  period = 'Last 30 Days',
}: ROICardProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const getROIStatus = (roi: number) => {
    if (roi >= 300) return { color: 'text-success-600', bg: 'bg-success-50' };
    if (roi >= 150) return { color: 'text-brand-600', bg: 'bg-brand-50' };
    if (roi >= 100) return { color: 'text-warning-600', bg: 'bg-warning-50' };
    return { color: 'text-danger-600', bg: 'bg-danger-50' };
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {period}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Total Spend</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalSpend)}</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Revenue</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Conversions</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {totalConversions.toLocaleString()}
          </p>
        </div>

        <div className="p-4 bg-brand-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {overallROI >= 100 ? (
              <TrendingUp className="h-4 w-4 text-brand-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger-600" />
            )}
            <span className="text-xs font-medium text-brand-600 uppercase">Overall ROI</span>
          </div>
          <p className="text-xl font-bold text-brand-600">{overallROI}%</p>
        </div>
      </div>

      {/* Channel Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Channel
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Spend
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Conversions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ROI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {channelData.map((channel) => {
              const status = getROIStatus(channel.roi);
              return (
                <tr key={channel.channel} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-900">
                      {channel.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-600">
                      ${channel.spend.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-600">
                      {channel.conversions.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${channel.revenue.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold ${status.color} ${status.bg}`}
                    >
                      {channel.roi >= 100 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {channel.roi}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ROI Bar Chart Visualization */}
      <div className="mt-6 space-y-3">
        <h4 className="text-sm font-medium text-slate-700">ROI by Channel</h4>
        {channelData.map((channel) => {
          const status = getROIStatus(channel.roi);
          const maxROI = Math.max(...channelData.map((c) => c.roi));
          const widthPercent = (channel.roi / maxROI) * 100;

          return (
            <div key={channel.channel}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600">{channel.channel}</span>
                <span className={`text-sm font-semibold ${status.color}`}>
                  {channel.roi}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    channel.roi >= 300
                      ? 'bg-success-500'
                      : channel.roi >= 150
                      ? 'bg-brand-500'
                      : channel.roi >= 100
                      ? 'bg-warning-500'
                      : 'bg-danger-500'
                  }`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Example usage data
export const channelROIData: ChannelROI[] = [
  { channel: 'Paid Search', spend: 45000, conversions: 1234, revenue: 92550, roi: 206 },
  { channel: 'Social Media', spend: 32000, conversions: 892, revenue: 66900, roi: 209 },
  { channel: 'Email', spend: 12000, conversions: 2341, revenue: 117050, roi: 876 },
  { channel: 'Display', spend: 28000, conversions: 456, revenue: 34200, roi: 122 },
  { channel: 'Organic', spend: 8000, conversions: 1876, revenue: 140700, roi: 1659 },
  { channel: 'Referral', spend: 15000, conversions: 967, revenue: 72525, roi: 384 },
];
