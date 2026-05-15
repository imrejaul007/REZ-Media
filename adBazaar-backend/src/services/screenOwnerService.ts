/**
 * AdBazaar - Screen Owner Service
 * Manages screen listings and owner accounts
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ScreenOwner,
  Screen,
  ScreenType,
  CaptivityLevel,
  SCREEN_CAPTIVITY_MAP,
  FloorPrice,
} from '../types';

// In-memory storage (would be MongoDB in production)
const owners: Map<string, ScreenOwner & { screens: Screen[] }> = new Map();

// ============================================================================
// SCREEN OWNER MANAGEMENT
// ============================================================================

export function registerOwner(data: {
  userId: string;
  businessName: string;
  gstin?: string;
  pan?: string;
  bankDetails?: ScreenOwner['bankDetails'];
}): ScreenOwner {
  const ownerId = `owner-${uuidv4().slice(0, 8)}`;

  const owner: ScreenOwner & { screens: Screen[] } = {
    ownerId,
    userId: data.userId,
    businessName: data.businessName,
    gstin: data.gstin,
    pan: data.pan,
    bankDetails: data.bankDetails,
    payoutSettings: {
      minPayoutThreshold: 1000,
      payoutFrequency: 'monthly',
      autoPayout: false,
    },
    stats: {
      totalScreens: 0,
      activeScreens: 0,
      totalEarnings: 0,
      pendingPayout: 0,
      totalImpressions: 0,
      avgFillRate: 0,
    },
    screens: [],
    createdAt: new Date(),
  };

  owners.set(ownerId, owner);
  return owner;
}

export function getOwner(ownerId: string): (ScreenOwner & { screens: Screen[] }) | null {
  return owners.get(ownerId) || null;
}

export function updateOwnerPayoutSettings(
  ownerId: string,
  settings: ScreenOwner['payoutSettings']
): ScreenOwner | null {
  const owner = owners.get(ownerId);
  if (!owner) return null;

  owner.payoutSettings = settings;
  return owner;
}

// ============================================================================
// SCREEN LISTING MANAGEMENT
// ============================================================================

export function addScreen(
  ownerId: string,
  data: {
    name: string;
    screenType: ScreenType;
    address: Screen['address'];
    coordinates: { lat: number; lng: number };
    dimensions: { width: number; height: number; unit: 'inches' | 'cm' };
    orientation: 'landscape' | 'portrait' | 'both';
    resolution?: string;
    availability: Screen['availability'];
    floorPrice: { cpm: number; currency: string; minCampaignBudget: number };
  }
): Screen | null {
  const owner = owners.get(ownerId);
  if (!owner) return null;

  const screenId = `screen-${uuidv4().slice(0, 8)}`;
  const captivityLevel = SCREEN_CAPTIVITY_MAP[data.screenType];

  const screen: Screen = {
    screenId,
    ownerId,
    name: data.name,
    screenType: data.screenType,
    captivityLevel,
    address: data.address,
    coordinates: data.coordinates,
    dimensions: data.dimensions,
    orientation: data.orientation,
    resolution: data.resolution,
    availability: data.availability,
    floorPrice: data.floorPrice,
    pricing: {
      model: 'cpm',
      dynamicPricing: true,
      discounts: {
        volume: [
          { minImpressions: 10000, discountPercent: 5 },
          { minImpressions: 50000, discountPercent: 10 },
          { minImpressions: 100000, discountPercent: 15 },
        ],
        duration: [
          { minDays: 7, discountPercent: 5 },
          { minDays: 30, discountPercent: 10 },
          { minDays: 90, discountPercent: 15 },
        ],
        loyalty: [
          { campaignsCompleted: 5, discountPercent: 5 },
          { campaignsCompleted: 10, discountPercent: 10 },
          { campaignsCompleted: 25, discountPercent: 15 },
        ],
      },
    },
    status: 'pending_approval',
    stats: {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      avgViewability: 0,
      fillRate: 0,
      lastUpdated: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  owner.screens.push(screen);
  owner.stats.totalScreens = owner.screens.length;
  owner.stats.activeScreens = owner.screens.filter(s => s.status === 'active').length;

  return screen;
}

export function updateScreen(
  ownerId: string,
  screenId: string,
  updates: Partial<Screen>
): Screen | null {
  const owner = owners.get(ownerId);
  if (!owner) return null;

  const screenIndex = owner.screens.findIndex(s => s.screenId === screenId);
  if (screenIndex === -1) return null;

  owner.screens[screenIndex] = {
    ...owner.screens[screenIndex],
    ...updates,
    screenId,
    ownerId,
    updatedAt: new Date(),
  };

  return owner.screens[screenIndex];
}

export function updateScreenStatus(
  ownerId: string,
  screenId: string,
  status: Screen['status']
): Screen | null {
  return updateScreen(ownerId, screenId, { status });
}

export function updateScreenPrice(
  ownerId: string,
  screenId: string,
  floorPrice: FloorPrice
): Screen | null {
  return updateScreen(ownerId, screenId, { floorPrice });
}

export function getScreen(screenId: string): Screen | null {
  for (const owner of owners.values()) {
    const screen = owner.screens.find(s => s.screenId === screenId);
    if (screen) return screen;
  }
  return null;
}

export function getOwnerScreens(ownerId: string): Screen[] {
  const owner = owners.get(ownerId);
  return owner?.screens || [];
}

export function getAllScreens(filters?: {
  screenTypes?: ScreenType[];
  cities?: string[];
  status?: Screen['status'];
}): Screen[] {
  let screens: Screen[] = [];

  for (const owner of owners.values()) {
    screens = screens.concat(owner.screens);
  }

  if (filters) {
    if (filters.screenTypes?.length) {
      screens = screens.filter(s => filters.screenTypes!.includes(s.screenType));
    }
    if (filters.cities?.length) {
      screens = screens.filter(s => filters.cities!.includes(s.address.city));
    }
    if (filters.status) {
      screens = screens.filter(s => s.status === filters.status);
    }
  }

  return screens;
}

// ============================================================================
// SCREEN STATS
// ============================================================================

export function updateScreenStats(
  screenId: string,
  stats: Partial<Screen['stats']>
): void {
  const screen = getScreen(screenId);
  if (!screen) return;

  screen.stats = {
    ...screen.stats,
    ...stats,
    lastUpdated: new Date(),
  };
}

export function recordImpression(screenId: string): void {
  const screen = getScreen(screenId);
  if (!screen) return;

  screen.stats.totalImpressions += 1;
  screen.stats.lastUpdated = new Date();

  // Update owner stats
  const owner = owners.get(screen.ownerId);
  if (owner) {
    owner.stats.totalImpressions += 1;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const screenOwnerService = {
  registerOwner,
  getOwner,
  updateOwnerPayoutSettings,
  addScreen,
  updateScreen,
  updateScreenStatus,
  updateScreenPrice,
  getScreen,
  getOwnerScreens,
  getAllScreens,
  updateScreenStats,
  recordImpression,
};

export default screenOwnerService;
