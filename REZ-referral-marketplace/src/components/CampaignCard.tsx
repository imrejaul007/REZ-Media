'use client';

import { Campaign } from '@/lib/api';
import { Calendar, Users, TrendingUp, DollarSign, ExternalLink, MoreHorizontal, Pause, Play, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CampaignCardProps {
  campaign: Campaign;
  onViewDetails?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPauseResume?: (id: string) => void;
}

export default function CampaignCard({ campaign, onViewDetails, onEdit, onPauseResume }: CampaignCardProps) {
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

  const getStatusBadge = (status: Campaign['status']) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
    };
    const icons = {
      active: <div className="w-2 h-2 rounded-full bg-green-500" />,
      paused: <div className="w-2 h-2 rounded-full bg-yellow-500" />,
      completed: <CheckCircle className="w-3 h-3" />,
      draft: <div className="w-2 h-2 rounded-full bg-gray-500" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const getPayoutLabel = (type: Campaign['payoutType']) => {
    const labels: Record<Campaign['payoutType'], string> = {
      cpa: 'Per Acquisition',
      cpl: 'Per Lead',
      cps: 'Per Sale',
      flat: 'Flat Rate',
    };
    return labels[type];
  };

  const progress = (campaign.currentReferrals / campaign.targetReferrals) * 100;
  const budgetProgress = (campaign.spent / campaign.budget) * 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-brand-200">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusBadge(campaign.status)}
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                {campaign.category}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
            <p className="text-sm text-gray-500">by {campaign.brand}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit?.(campaign.id)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{campaign.description}</p>

        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium text-gray-700">{formatCurrency(campaign.payoutAmount)}</span>
            <span className="text-gray-400">/ {getPayoutLabel(campaign.payoutType).toLowerCase()}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Referrals</span>
            </div>
            <p className="font-semibold text-gray-900">{formatNumber(campaign.currentReferrals)}</p>
            <p className="text-xs text-gray-400">of {formatNumber(campaign.targetReferrals)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Conversion</span>
            </div>
            <p className="font-semibold text-gray-900">{campaign.conversionRate}%</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Creators</span>
            </div>
            <p className="font-semibold text-gray-900">{campaign.creatorCount}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Referral Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Budget Used</span>
            <span>{formatCurrency(campaign.spent)} / {formatCurrency(campaign.budget)}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${budgetProgress > 90 ? 'bg-red-500' : budgetProgress > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(budgetProgress, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Started {format(parseISO(campaign.startDate), 'MMM d, yyyy')}</span>
          </div>
          {campaign.endDate && (
            <div className="flex items-center gap-1.5">
              <span>Ends {format(parseISO(campaign.endDate), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 flex gap-2">
        <button
          onClick={() => onViewDetails?.(campaign.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          View Details
        </button>
        {campaign.status === 'active' && (
          <button
            onClick={() => onPauseResume?.(campaign.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {campaign.status === 'paused' && (
          <button
            onClick={() => onPauseResume?.(campaign.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
