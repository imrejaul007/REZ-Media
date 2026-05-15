/**
 * REZ Live Shopping - Types
 */

export interface LiveSession {
  id: string;
  merchantId: string;
  hostId: string;
  title: string;
  description: string;
  thumbnail: string;
  status: 'scheduled' | 'live' | 'ended';
  startTime: Date;
  endTime?: Date;
  products: LiveProduct[];
  viewers: number;
  likes: number;
  createdAt: Date;
}

export interface LiveProduct {
  id: string;
  productId: string;
  name: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  featured: boolean;
  spotlight: boolean; // Currently highlighted
}

export interface LiveViewer {
  id: string;
  sessionId: string;
  userId?: string;
  guestId: string;
  joinedAt: Date;
  likes: number;
  comments: number;
  purchases: number;
}

export interface LiveComment {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  type: 'comment' | 'question' | 'emoji';
  featured: boolean;
  createdAt: Date;
}

export interface LivePurchase {
  id: string;
  sessionId: string;
  userId: string;
  productId: string;
  quantity: number;
  price: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

export interface FlashDeal {
  id: string;
  sessionId: string;
  productId: string;
  name: string;
  originalPrice: number;
  flashPrice: number;
  stock: number;
  sold: number;
  startsAt: Date;
  endsAt: Date;
  status: 'upcoming' | 'active' | 'ended';
}

export interface StreamAnalytics {
  sessionId: string;
  peakViewers: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalPurchases: number;
  revenue: number;
  conversionRate: number;
  avgWatchTime: number;
}
