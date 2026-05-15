/**
 * REZ Live Shopping - Live Shopping Service
 * Real-time shopping experience with video
 */

import { LiveSession, LiveProduct, LiveComment, FlashDeal, LivePurchase } from '../types';

export class LiveShoppingService {
  private sessions: Map<string, LiveSession> = new Map();

  /**
   * Create a live shopping session
   */
  async createSession(
    merchantId: string,
    hostId: string,
    title: string,
    description: string,
    products: LiveProduct[]
  ): Promise<LiveSession> {
    const session: LiveSession = {
      id: `live-${Date.now()}`,
      merchantId,
      hostId,
      title,
      description,
      thumbnail: '',
      status: 'scheduled',
      startTime: new Date(),
      products,
      viewers: 0,
      likes: 0,
      createdAt: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Start live session
   */
  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'live';
    session.startTime = new Date();
    this.sessions.set(sessionId, session);
  }

  /**
   * Add product to session
   */
  async addProduct(
    sessionId: string,
    product: LiveProduct
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.products.push(product);
    this.sessions.set(sessionId, session);
  }

  /**
   * Spotlight product (highlight for all viewers)
   */
  async spotlightProduct(
    sessionId: string,
    productId: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Reset all spotlight flags
    session.products.forEach((p) => {
      p.spotlight = p.id === productId;
    });

    this.sessions.set(sessionId, session);
  }

  /**
   * Add flash deal
   */
  async createFlashDeal(
    sessionId: string,
    productId: string,
    name: string,
    originalPrice: number,
    flashPrice: number,
    stock: number,
    durationMinutes: number
  ): Promise<FlashDeal> {
    const deal: FlashDeal = {
      id: `deal-${Date.now()}`,
      sessionId,
      productId,
      name,
      originalPrice,
      flashPrice,
      stock,
      sold: 0,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + durationMinutes * 60000),
      status: 'active',
    };

    return deal;
  }

  /**
   * Purchase during live
   */
  async purchase(
    sessionId: string,
    userId: string,
    productId: string,
    quantity: number
  ): Promise<LivePurchase> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const product = session.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found');

    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // Deduct stock
    product.stock -= quantity;

    const purchase: LivePurchase = {
      id: `purchase-${Date.now()}`,
      sessionId,
      userId,
      productId,
      quantity,
      price: product.discountedPrice || product.price,
      totalAmount: (product.discountedPrice || product.price) * quantity,
      status: 'confirmed',
      createdAt: new Date(),
    };

    // Update session analytics
    session.viewers++; // Count as engagement

    this.sessions.set(sessionId, session);

    return purchase;
  }

  /**
   * Add comment
   */
  async addComment(
    sessionId: string,
    userId: string,
    userName: string,
    message: string,
    type: 'comment' | 'question' | 'emoji' = 'comment'
  ): Promise<LiveComment> {
    const comment: LiveComment = {
      id: `comment-${Date.now()}`,
      sessionId,
      userId,
      userName,
      message,
      type,
      featured: false,
      createdAt: new Date(),
    };

    return comment;
  }

  /**
   * Get session analytics
   */
  async getAnalytics(sessionId: string): Promise<{
    peakViewers: number;
    totalLikes: number;
    conversionRate: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const purchases = 10; // Would fetch from DB
    const conversionRate = session.viewers > 0 ? (purchases / session.viewers) * 100 : 0;

    return {
      peakViewers: session.viewers,
      totalLikes: session.likes,
      conversionRate,
    };
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'ended';
    session.endTime = new Date();
    this.sessions.set(sessionId, session);
  }
}

export const liveShoppingService = new LiveShoppingService();
