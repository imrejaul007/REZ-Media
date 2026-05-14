'use client';

import { useEffect, useState } from 'react';
import { getCreators, Creator } from '@/lib/api';
import CreatorCard from '@/components/CreatorCard';
import {
  Search,
  Filter,
  Grid,
  List,
  Users,
  TrendingUp,
  Star,
  X,
  ChevronDown,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type SortOption = 'rating' | 'followers' | 'earnings' | 'referrals';

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const niches = [
    'Fashion & Lifestyle',
    'Tech & Gadgets',
    'Beauty & Skincare',
    'Fitness & Health',
    'Food & Recipes',
  ];

  useEffect(() => {
    const loadCreators = async () => {
      try {
        const data = await getCreators();
        setCreators(data);
      } catch (error) {
        console.error('Failed to load creators:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCreators();
  }, []);

  const filteredCreators = creators
    .filter((creator) => {
      const matchesSearch =
        creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.niche.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.specialties.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesNiche =
        selectedNiches.length === 0 || selectedNiches.includes(creator.niche);

      const matchesVerified = !verifiedOnly || creator.verified;

      return matchesSearch && matchesNiche && matchesVerified;
    })
    .sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      switch (sortBy) {
        case 'rating':
          return (a.rating - b.rating) * multiplier;
        case 'followers':
          return (a.followers - b.followers) * multiplier;
        case 'earnings':
          return (a.earnings - b.earnings) * multiplier;
        case 'referrals':
          return (a.totalReferrals - b.totalReferrals) * multiplier;
        default:
          return 0;
      }
    });

  const handleViewProfile = (id: string) => {
    console.log('View profile:', id);
  };

  const handleInvite = (id: string) => {
    console.log('Invite creator:', id);
  };

  const toggleNiche = (niche: string) => {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : [...prev, niche]
    );
  };

  const clearFilters = () => {
    setSelectedNiches([]);
    setVerifiedOnly(false);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedNiches.length > 0 || verifiedOnly || searchQuery !== '';

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Creator Marketplace</h1>
          <p className="text-gray-500 mt-1">Discover and connect with top-performing creators</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{creators.length} Creators</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, niche, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">
                  {selectedNiches.length + (verifiedOnly ? 1 : 0)}
                </span>
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="rating">Sort by Rating</option>
              <option value="followers">Sort by Followers</option>
              <option value="earnings">Sort by Earnings</option>
              <option value="referrals">Sort by Referrals</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            >
              <TrendingUp className={`w-4 h-4 text-gray-600 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-4">
              {/* Niche Filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Niche</label>
                <div className="flex flex-wrap gap-2">
                  {niches.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => toggleNiche(niche)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedNiches.includes(niche)
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Filter */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Status</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-600">Verified only</span>
                </label>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Total Followers</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumber(creators.reduce((sum, c) => sum + c.followers, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Referrals</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumber(creators.reduce((sum, c) => sum + c.totalReferrals, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Star className="w-3.5 h-3.5" />
            <span>Avg Rating</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {(creators.reduce((sum, c) => sum + c.rating, 0) / creators.length).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Verified</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {creators.filter((c) => c.verified).length}
          </p>
        </div>
      </div>

      {/* Creators Grid/List */}
      {loading ? (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-32" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="h-16 bg-gray-100 rounded-lg" />
                <div className="h-16 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              onViewProfile={handleViewProfile}
              onInvite={handleInvite}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!loading && filteredCreators.length > 0 && (
        <p className="text-center text-sm text-gray-500 mt-6">
          Showing {filteredCreators.length} of {creators.length} creators
        </p>
      )}
    </div>
  );
}
