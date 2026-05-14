// Type definitions for the Referral Marketplace

export interface Creator {
  id: string;
  name: string;
  avatar: string;
  niche: string;
  followers: number;
  engagementRate: number;
  totalReferrals: number;
  conversionRate: number;
  rating: number;
  earnings: number;
  specialties: string[];
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
  };
  verified: boolean;
  joinedAt: string;
  successRate: number;
  avgCommission: number;
}

export interface Campaign {
  id: string;
  name: string;
  brand: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  budget: number;
  spent: number;
  payoutType: 'cpa' | 'cpl' | 'cps' | 'flat';
  payoutAmount: number;
  startDate: string;
  endDate: string | null;
  targetReferrals: number;
  currentReferrals: number;
  conversionRate: number;
  creatorCount: number;
  category: string;
  requirements: string[];
  createdAt: string;
}

export interface Analytics {
  totalReferrals: number;
  totalRevenue: number;
  activeCampaigns: number;
  totalCreators: number;
  conversionRate: number;
  avgCommission: number;
  monthlyData: MonthlyData[];
  topCampaigns: TopCampaign[];
  topCreators: TopCreator[];
  recentActivity: Activity[];
}

export interface MonthlyData {
  month: string;
  referrals: number;
  revenue: number;
  conversions: number;
}

export interface TopCampaign {
  id: string;
  name: string;
  referrals: number;
  revenue: number;
  conversionRate: number;
}

export interface TopCreator {
  id: string;
  name: string;
  avatar: string;
  referrals: number;
  earnings: number;
}

export interface Activity {
  id: string;
  type: 'referral' | 'signup' | 'payout' | 'campaign_created' | 'creator_joined';
  description: string;
  amount?: number;
  timestamp: string;
}

export interface Payout {
  id: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
}

// Mock data for development
export const mockCreators: Creator[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    niche: 'Fashion & Lifestyle',
    followers: 125000,
    engagementRate: 4.8,
    totalReferrals: 2340,
    conversionRate: 3.2,
    rating: 4.9,
    earnings: 45200,
    specialties: ['Instagram', 'TikTok', 'YouTube'],
    socialLinks: { instagram: '@sarahchen', twitter: '@sarahfashion' },
    verified: true,
    joinedAt: '2024-01-15',
    successRate: 87,
    avgCommission: 19.3,
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    niche: 'Tech & Gadgets',
    followers: 89000,
    engagementRate: 5.2,
    totalReferrals: 1890,
    conversionRate: 4.1,
    rating: 4.7,
    earnings: 38100,
    specialties: ['YouTube', 'Twitter', 'TikTok'],
    socialLinks: { youtube: '@marcustech', twitter: '@marcusj' },
    verified: true,
    joinedAt: '2024-02-20',
    successRate: 92,
    avgCommission: 20.2,
  },
  {
    id: '3',
    name: 'Priya Patel',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    niche: 'Beauty & Skincare',
    followers: 210000,
    engagementRate: 6.1,
    totalReferrals: 4120,
    conversionRate: 3.8,
    rating: 4.8,
    earnings: 78400,
    specialties: ['Instagram', 'YouTube', 'TikTok'],
    socialLinks: { instagram: '@priyabeauty' },
    verified: true,
    joinedAt: '2023-11-05',
    successRate: 89,
    avgCommission: 19.0,
  },
  {
    id: '4',
    name: 'Alex Rivera',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    niche: 'Fitness & Health',
    followers: 67000,
    engagementRate: 5.5,
    totalReferrals: 1560,
    conversionRate: 3.5,
    rating: 4.6,
    earnings: 29800,
    specialties: ['TikTok', 'Instagram', 'YouTube'],
    socialLinks: { tiktok: '@alexfit', instagram: '@alexfitness' },
    verified: false,
    joinedAt: '2024-03-10',
    successRate: 84,
    avgCommission: 19.1,
  },
  {
    id: '5',
    name: 'Emma Wilson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    niche: 'Food & Recipes',
    followers: 156000,
    engagementRate: 4.9,
    totalReferrals: 2980,
    conversionRate: 3.9,
    rating: 4.9,
    earnings: 56200,
    specialties: ['YouTube', 'Instagram', 'TikTok'],
    socialLinks: { youtube: '@emmawilson', instagram: '@emmaeats' },
    verified: true,
    joinedAt: '2023-09-22',
    successRate: 91,
    avgCommission: 18.9,
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Summer Fashion Sale',
    brand: 'StyleHub',
    description: 'Promote our summer collection and earn commissions on every sale',
    status: 'active',
    budget: 50000,
    spent: 23400,
    payoutType: 'cps',
    payoutAmount: 15,
    startDate: '2024-05-01',
    endDate: '2024-08-31',
    targetReferrals: 5000,
    currentReferrals: 3240,
    conversionRate: 4.2,
    creatorCount: 45,
    category: 'Fashion',
    requirements: ['Instagram', 'Minimum 10k followers', 'Fashion niche'],
    createdAt: '2024-04-15',
  },
  {
    id: '2',
    name: 'Tech Gadget Launch',
    brand: 'GadgetPro',
    description: 'Be part of our flagship product launch campaign',
    status: 'active',
    budget: 75000,
    spent: 41200,
    payoutType: 'cpa',
    payoutAmount: 25,
    startDate: '2024-04-01',
    endDate: '2024-06-30',
    targetReferrals: 3000,
    currentReferrals: 2180,
    conversionRate: 5.8,
    creatorCount: 62,
    category: 'Technology',
    requirements: ['YouTube', 'Tech reviews', 'Minimum 50k followers'],
    createdAt: '2024-03-20',
  },
  {
    id: '3',
    name: 'Beauty Box Subscription',
    brand: 'GlowBox',
    description: 'Refer new subscribers and earn recurring commissions',
    status: 'active',
    budget: 30000,
    spent: 12800,
    payoutType: 'cpl',
    payoutAmount: 12,
    startDate: '2024-05-15',
    endDate: null,
    targetReferrals: 2000,
    currentReferrals: 890,
    conversionRate: 3.1,
    creatorCount: 28,
    category: 'Beauty',
    requirements: ['Beauty niche', 'Instagram or TikTok', 'Minimum 5k followers'],
    createdAt: '2024-05-10',
  },
  {
    id: '4',
    name: 'Fitness App Promo',
    brand: 'FitLife',
    description: 'Get people to join our premium fitness community',
    status: 'paused',
    budget: 40000,
    spent: 15600,
    payoutType: 'cps',
    payoutAmount: 20,
    startDate: '2024-03-01',
    endDate: '2024-06-01',
    targetReferrals: 4000,
    currentReferrals: 1200,
    conversionRate: 2.8,
    creatorCount: 35,
    category: 'Fitness',
    requirements: ['Fitness content', 'Any platform', 'Minimum 10k followers'],
    createdAt: '2024-02-25',
  },
  {
    id: '5',
    name: 'Food Delivery Launch',
    brand: 'QuickEats',
    description: 'Join our food delivery service launch in new cities',
    status: 'completed',
    budget: 25000,
    spent: 25000,
    payoutType: 'flat',
    payoutAmount: 5,
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    targetReferrals: 10000,
    currentReferrals: 12450,
    conversionRate: 6.2,
    creatorCount: 78,
    category: 'Food & Beverage',
    requirements: ['Food content', 'Local presence', 'Any follower count'],
    createdAt: '2023-12-15',
  },
];

export const mockAnalytics: Analytics = {
  totalReferrals: 45890,
  totalRevenue: 892450,
  activeCampaigns: 23,
  totalCreators: 156,
  conversionRate: 4.2,
  avgCommission: 19.45,
  monthlyData: [
    { month: 'Jan', referrals: 3200, revenue: 62400, conversions: 134 },
    { month: 'Feb', referrals: 4100, revenue: 79800, conversions: 172 },
    { month: 'Mar', referrals: 4800, revenue: 93600, conversions: 202 },
    { month: 'Apr', referrals: 5200, revenue: 101200, conversions: 218 },
    { month: 'May', referrals: 6100, revenue: 118700, conversions: 256 },
    { month: 'Jun', referrals: 7200, revenue: 140200, conversions: 302 },
  ],
  topCampaigns: [
    { id: '2', name: 'Tech Gadget Launch', referrals: 2180, revenue: 54500, conversionRate: 5.8 },
    { id: '1', name: 'Summer Fashion Sale', referrals: 3240, revenue: 48600, conversionRate: 4.2 },
    { id: '5', name: 'Food Delivery Launch', referrals: 12450, revenue: 62250, conversionRate: 6.2 },
  ],
  topCreators: [
    { id: '3', name: 'Priya Patel', avatar: mockCreators[2].avatar, referrals: 4120, earnings: 78400 },
    { id: '5', name: 'Emma Wilson', avatar: mockCreators[4].avatar, referrals: 2980, earnings: 56200 },
    { id: '1', name: 'Sarah Chen', avatar: mockCreators[0].avatar, referrals: 2340, earnings: 45200 },
  ],
  recentActivity: [
    { id: '1', type: 'referral', description: 'New referral from Priya Patel', amount: 15, timestamp: '2024-06-15T14:32:00Z' },
    { id: '2', type: 'payout', description: 'Payout processed for Sarah Chen', amount: 450, timestamp: '2024-06-15T12:00:00Z' },
    { id: '3', type: 'signup', description: 'New creator joined: Alex Rivera', timestamp: '2024-06-15T10:15:00Z' },
    { id: '4', type: 'campaign_created', description: 'Campaign "Tech Gadget Launch" exceeded target', timestamp: '2024-06-14T16:45:00Z' },
    { id: '5', type: 'referral', description: 'New referral from Marcus Johnson', amount: 25, timestamp: '2024-06-14T15:20:00Z' },
  ],
};

export const mockPayouts: Payout[] = [
  { id: '1', creatorId: '1', creatorName: 'Sarah Chen', campaignId: '1', campaignName: 'Summer Fashion Sale', amount: 450, status: 'completed', createdAt: '2024-06-01T00:00:00Z', processedAt: '2024-06-15T12:00:00Z' },
  { id: '2', creatorId: '3', creatorName: 'Priya Patel', campaignId: '1', campaignName: 'Summer Fashion Sale', amount: 780, status: 'completed', createdAt: '2024-06-01T00:00:00Z', processedAt: '2024-06-15T12:00:00Z' },
  { id: '3', creatorId: '2', creatorName: 'Marcus Johnson', campaignId: '2', campaignName: 'Tech Gadget Launch', amount: 625, status: 'processing', createdAt: '2024-06-10T00:00:00Z' },
  { id: '4', creatorId: '5', creatorName: 'Emma Wilson', campaignId: '1', campaignName: 'Summer Fashion Sale', amount: 320, status: 'pending', createdAt: '2024-06-14T00:00:00Z' },
  { id: '5', creatorId: '4', creatorName: 'Alex Rivera', campaignId: '4', campaignName: 'Fitness App Promo', amount: 180, status: 'pending', createdAt: '2024-06-14T00:00:00Z' },
];

// API Functions
export async function getCreators(filters?: { niche?: string; minFollowers?: number }): Promise<Creator[]> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  let filtered = [...mockCreators];

  if (filters?.niche) {
    filtered = filtered.filter(c => c.niche.toLowerCase().includes(filters.niche!.toLowerCase()));
  }
  if (filters?.minFollowers) {
    filtered = filtered.filter(c => c.followers >= filters.minFollowers!);
  }

  return filtered;
}

export async function getCreator(id: string): Promise<Creator | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockCreators.find(c => c.id === id) || null;
}

export async function getCampaigns(filters?: { status?: string; category?: string }): Promise<Campaign[]> {
  await new Promise(resolve => setTimeout(resolve, 500));

  let filtered = [...mockCampaigns];

  if (filters?.status) {
    filtered = filtered.filter(c => c.status === filters.status);
  }
  if (filters?.category) {
    filtered = filtered.filter(c => c.category.toLowerCase().includes(filters.category!.toLowerCase()));
  }

  return filtered;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockCampaigns.find(c => c.id === id) || null;
}

export async function getAnalytics(): Promise<Analytics> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockAnalytics;
}

export async function getPayouts(): Promise<Payout[]> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockPayouts;
}

export async function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'currentReferrals'>): Promise<Campaign> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const newCampaign: Campaign = {
    ...data,
    id: String(mockCampaigns.length + 1),
    currentReferrals: 0,
    createdAt: new Date().toISOString().split('T')[0],
  };

  mockCampaigns.push(newCampaign);
  return newCampaign;
}

export async function inviteCreator(campaignId: string, creatorId: string): Promise<{ success: boolean }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true };
}

export async function processPayout(payoutIds: string[]): Promise<{ processed: number }> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { processed: payoutIds.length };
}
