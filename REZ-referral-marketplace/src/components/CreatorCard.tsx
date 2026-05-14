'use client';

import Image from 'next/image';
import { Creator } from '@/lib/api';
import { Star, Users, TrendingUp, DollarSign, CheckCircle, ExternalLink } from 'lucide-react';

interface CreatorCardProps {
  creator: Creator;
  onViewProfile?: (id: string) => void;
  onInvite?: (id: string) => void;
}

export default function CreatorCard({ creator, onViewProfile, onInvite }: CreatorCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getNicheColor = (niche: string) => {
    const colors: Record<string, string> = {
      'Fashion & Lifestyle': 'bg-pink-100 text-pink-700',
      'Tech & Gadgets': 'bg-blue-100 text-blue-700',
      'Beauty & Skincare': 'bg-purple-100 text-purple-700',
      'Fitness & Health': 'bg-green-100 text-green-700',
      'Food & Recipes': 'bg-orange-100 text-orange-700',
    };
    return colors[niche] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-brand-200">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Image
              src={creator.avatar}
              alt={creator.name}
              width={64}
              height={64}
              className="rounded-full"
            />
            {creator.verified && (
              <div className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full p-1">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{creator.name}</h3>
            </div>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getNicheColor(creator.niche)}`}>
              {creator.niche}
            </span>
          </div>

          <div className="flex items-center gap-1 text-yellow-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">{creator.rating}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Followers</span>
            </div>
            <p className="font-semibold text-gray-900">{formatNumber(creator.followers)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Engagement</span>
            </div>
            <p className="font-semibold text-gray-900">{creator.engagementRate}%</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Referrals</span>
            </div>
            <p className="font-semibold text-gray-900">{formatNumber(creator.totalReferrals)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Earnings</span>
            </div>
            <p className="font-semibold text-gray-900">${formatNumber(creator.earnings)}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Success Rate</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${creator.successRate}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">{creator.successRate}%</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {creator.specialties.map((specialty) => (
            <span
              key={specialty}
              className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium"
            >
              {specialty}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 flex gap-2">
        <button
          onClick={() => onViewProfile?.(creator.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          View Profile
        </button>
        <button
          onClick={() => onInvite?.(creator.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          Invite
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
