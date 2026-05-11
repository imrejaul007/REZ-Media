/**
 * COIN MARKETPLACE ENGINE - Phase 4
 * Handles buying, gifting, exchanging, and trading coins
 *
 * Features:
 * - Coin Purchase (REZ TRY, branded coins, bundles)
 * - Coin Gifting (gift to friends, specific types/amounts)
 * - Coin Exchange (brand coins → REZ coins at discount)
 * - Marketplace Listings (user listings, price discovery, escrow)
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const MARKETPLACE_PREFIX = 'marketplace:';
const COIN_PREFIX = 'coins:';
const ESCROW_PREFIX = 'escrow:';
const GIFT_PREFIX = 'gift:';
const EXCHANGE_PREFIX = 'exchange:';

const DEFAULT_CONFIG = {
  // Pricing
  REZ_TRY_PRICE_PER_COIN: 0.1, // ₹10 = 100 coins → 1 coin = ₹0.10
  MIN_LISTING_AMOUNT: 10,
  MAX_LISTING_AMOUNT: 10000,

  // Exchange rates (brand coin → REZ coin)
  DEFAULT_EXCHANGE_RATE: 0.8, // 80% value retention
  BRAND_EXCHANGE_RATES: {
    'KFC': 0.75,
    'MCDONALDS': 0.8,
    'SUBWAY': 0.7,
    'DOMINOS': 0.75,
    'STARBUCKS': 0.85,
    'DEFAULT': 0.8
  },

  // Fees
  MARKETPLACE_FEE_PERCENT: 2.5, // 2.5% fee on sales
  GIFT_FEE_PERCENT: 0, // No fee for gifting
  EXCHANGE_FEE_PERCENT: 1, // 1% fee on exchanges

  // Escrow
  ESCROW_RELEASE_DELAY_MS: 60000, // 1 minute delay for disputes
  MAX_DISPUTE_WINDOW_MS: 300000, // 5 minutes to raise dispute

  // Rate limits
  MAX_PURCHASES_PER_DAY: 50,
  MAX_LISTINGS_PER_USER: 20,
  MAX_GIFTS_PER_DAY: 20,
  MAX_EXCHANGES_PER_DAY: 10,

  // Bundle discounts
  BUNDLE_PACKAGES: {
    'STARTER': { coins: 100, price: 9, label: 'Starter Pack' },
    'BASIC': { coins: 500, price: 40, label: 'Basic Pack' },
    'PREMIUM': { coins: 1000, price: 75, label: 'Premium Pack' },
    'VIP': { coins: 5000, price: 350, label: 'VIP Pack' }
  }
};

// ============================================
// INTERFACES
// ============================================

export interface CoinListing {
  id: string;
  sellerId: string;
  coinType: string;
  amount: number;
  pricePerCoin: number;
  totalPrice: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  escrowId?: string;
}

export interface CoinPurchase {
  id: string;
  listingId: string;
  buyerId: string;
  amount: number;
  totalPrice: number;
  paymentId: string;
  status: 'pending' | 'completed' | 'refunded' | 'disputed';
  createdAt: string;
  completedAt?: string;
}

export interface CoinGifting {
  id: string;
  senderId: string;
  recipientId: string;
  coinType: string;
  amount: number;
  message?: string;
  status: 'pending' | 'delivered' | 'claimed' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
  transactionId?: string;
}

export interface CoinExchange {
  id: string;
  userId: string;
  fromCoinType: string;
  fromAmount: number;
  toCoinType: string;
  toAmount: number;
  exchangeRate: number;
  fee: number;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface EscrowTransaction {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  coinType: string;
  amount: number;
  price: number;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  createdAt: string;
  releaseAt?: string;
  disputeReason?: string;
}

export interface CoinBalance {
  userId: string;
  balances: {
    'REZ': number;
    'REZ_TRY': number;
    [brand: string]: number;
  };
  lastUpdated: string;
}

export interface PurchaseRequest {
  coinType: string;
  amount: number;
  paymentMethod: 'REZ_TRY' | 'CARD' | 'WALLET';
  paymentId?: string;
}

export interface ListingRequest {
  coinType: string;
  amount: number;
  pricePerCoin: number;
  durationHours?: number;
}

export interface GiftRequest {
  recipientId: string;
  coinType: string;
  amount: number;
  message?: string;
}

export interface ExchangeRequest {
  fromCoinType: string;
  fromAmount: number;
  toCoinType?: string; // Defaults to REZ
}

// ============================================
// COIN BALANCE MANAGER
// ============================================

export class CoinBalanceManager {
  /**
   * Get user's coin balances
   */
  async getBalance(userId: string): Promise<CoinBalance> {
    const key = `${COIN_PREFIX}balance:${userId}`;
    const data = await redis.hgetall(key);

    const balances: CoinBalance['balances'] = {
      'REZ': parseInt(data['REZ'] || '0'),
      'REZ_TRY': parseInt(data['REZ_TRY'] || '0')
    };

    // Load brand-specific balances
    const brandKeys = await redis.keys(`${key}:brand:*`);
    for (const brandKey of brandKeys) {
      const brand = brandKey.split(':').pop() || '';
      balances[brand] = parseInt(await redis.get(brandKey) || '0');
    }

    return {
      userId,
      balances,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Add coins to user balance
   */
  async addCoins(
    userId: string,
    coinType: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    if (amount <= 0) return false;

    const key = `${COIN_PREFIX}balance:${userId}`;
    const isBrandCoin = !['REZ', 'REZ_TRY'].includes(coinType);
    const targetKey = isBrandCoin ? `${key}:brand:${coinType}` : `${key}:${coinType}`;

    const pipeline = redis.pipeline();
    pipeline.incrbyfloat(targetKey, amount);
    pipeline.hset(key, 'lastUpdated', Date.now().toString());

    // Record transaction
    pipeline.lpush(`${COIN_PREFIX}tx:${userId}`, JSON.stringify({
      type: 'credit',
      coinType,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      balance: 'pending' // Will be updated after exec
    }));
    pipeline.ltrim(`${COIN_PREFIX}tx:${userId}`, 0, 999); // Keep last 1000

    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[CoinBalanceManager] Failed to add coins:', error);
      return false;
    }
  }

  /**
   * Deduct coins from user balance
   */
  async deductCoins(
    userId: string,
    coinType: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    if (amount <= 0) return false;

    const key = `${COIN_PREFIX}balance:${userId}`;
    const isBrandCoin = !['REZ', 'REZ_TRY'].includes(coinType);
    const targetKey = isBrandCoin ? `${key}:brand:${coinType}` : `${key}:${coinType}`;

    // Check sufficient balance
    const currentBalance = parseInt(await redis.get(targetKey) || '0');
    if (currentBalance < amount) {
      console.log(`[CoinBalanceManager] Insufficient balance: ${currentBalance} < ${amount}`);
      return false;
    }

    const pipeline = redis.pipeline();
    pipeline.incrbyfloat(targetKey, -amount);
    pipeline.hset(key, 'lastUpdated', Date.now().toString());

    // Record transaction
    pipeline.lpush(`${COIN_PREFIX}tx:${userId}`, JSON.stringify({
      type: 'debit',
      coinType,
      amount: -amount,
      reason,
      timestamp: new Date().toISOString()
    }));
    pipeline.ltrim(`${COIN_PREFIX}tx:${userId}`, 0, 999);

    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[CoinBalanceManager] Failed to deduct coins:', error);
      return false;
    }
  }

  /**
   * Transfer coins between users
   */
  async transferCoins(
    fromUserId: string,
    toUserId: string,
    coinType: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    // Deduct from sender
    const deducted = await this.deductCoins(fromUserId, coinType, amount, `Transfer to ${toUserId}`);
    if (!deducted) return false;

    // Add to recipient
    const added = await this.addCoins(toUserId, coinType, amount, `Transfer from ${fromUserId}`);
    if (!added) {
      // Rollback: add back to sender
      await this.addCoins(fromUserId, coinType, amount, 'Transfer failed - rollback');
      return false;
    }

    return true;
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50
  ): Promise<Array<{
    type: string;
    coinType: string;
    amount: number;
    reason: string;
    timestamp: string;
  }>> {
    const transactions = await redis.lrange(`${COIN_PREFIX}tx:${userId}`, 0, limit - 1);
    return transactions.map(t => JSON.parse(t));
  }
}

// ============================================
// ESCROW MANAGER
// ============================================

export class EscrowManager {
  private balanceManager: CoinBalanceManager;

  constructor(balanceManager: CoinBalanceManager) {
    this.balanceManager = balanceManager;
  }

  /**
   * Create escrow hold for a listing
   */
  async createEscrow(
    listingId: string,
    sellerId: string,
    buyerId: string,
    coinType: string,
    amount: number,
    price: number
  ): Promise<EscrowTransaction> {
    const escrowId = uuidv4();
    const now = new Date();

    const escrow: EscrowTransaction = {
      id: escrowId,
      listingId,
      sellerId,
      buyerId,
      coinType,
      amount,
      price,
      status: 'held',
      createdAt: now.toISOString(),
      releaseAt: new Date(now.getTime() + DEFAULT_CONFIG.ESCROW_RELEASE_DELAY_MS).toISOString()
    };

    // Store escrow in Redis
    await redis.set(`${ESCROW_PREFIX}${escrowId}`, JSON.stringify(escrow));
    await redis.setex(`${ESCROW_PREFIX}listing:${listingId}`, 86400, escrowId);

    // Create escrow index for buyer and seller
    await redis.sadd(`${ESCROW_PREFIX}buyer:${buyerId}`, escrowId);
    await redis.sadd(`${ESCROW_PREFIX}seller:${sellerId}`, escrowId);

    console.log(`[EscrowManager] Created escrow ${escrowId} for listing ${listingId}`);
    return escrow;
  }

  /**
   * Release escrow to buyer (after successful payment)
   */
  async releaseEscrow(escrowId: string): Promise<boolean> {
    const escrowData = await redis.get(`${ESCROW_PREFIX}${escrowId}`);
    if (!escrowData) {
      console.error(`[EscrowManager] Escrow ${escrowId} not found`);
      return false;
    }

    const escrow: EscrowTransaction = JSON.parse(escrowData);

    if (escrow.status !== 'held') {
      console.error(`[EscrowManager] Escrow ${escrowId} is not in 'held' status`);
      return false;
    }

    // Transfer coins from escrow to buyer
    const transferred = await this.balanceManager.transferCoins(
      escrow.sellerId,
      escrow.buyerId,
      escrow.coinType,
      escrow.amount,
      `Marketplace purchase - escrow released`
    );

    if (!transferred) {
      console.error(`[EscrowManager] Failed to transfer coins for escrow ${escrowId}`);
      return false;
    }

    // Update escrow status
    escrow.status = 'released';
    await redis.set(`${ESCROW_PREFIX}${escrowId}`, JSON.stringify(escrow));

    console.log(`[EscrowManager] Released escrow ${escrowId}`);
    return true;
  }

  /**
   * Raise dispute on escrow
   */
  async raiseDispute(escrowId: string, reason: string): Promise<boolean> {
    const escrowData = await redis.get(`${ESCROW_PREFIX}${escrowId}`);
    if (!escrowData) return false;

    const escrow: EscrowTransaction = JSON.parse(escrowData);

    // Check if within dispute window
    const createdAt = new Date(escrow.createdAt).getTime();
    const now = Date.now();
    if (now - createdAt > DEFAULT_CONFIG.MAX_DISPUTE_WINDOW_MS) {
      console.error(`[EscrowManager] Dispute window expired for escrow ${escrowId}`);
      return false;
    }

    escrow.status = 'disputed';
    escrow.disputeReason = reason;

    await redis.set(`${ESCROW_PREFIX}${escrowId}`, JSON.stringify(escrow));
    await redis.lpush(`${ESCROW_PREFIX}disputes`, escrowId);

    console.log(`[EscrowManager] Dispute raised on escrow ${escrowId}: ${reason}`);
    return true;
  }

  /**
   * Refund escrow to seller
   */
  async refundEscrow(escrowId: string): Promise<boolean> {
    const escrowData = await redis.get(`${ESCROW_PREFIX}${escrowId}`);
    if (!escrowData) return false;

    const escrow: EscrowTransaction = JSON.parse(escrowData);

    if (escrow.status !== 'disputed') {
      console.error(`[EscrowManager] Can only refund disputed escrows`);
      return false;
    }

    // Return coins to seller
    const returned = await this.balanceManager.addCoins(
      escrow.sellerId,
      escrow.coinType,
      escrow.amount,
      'Escrow refund - dispute resolved'
    );

    if (!returned) {
      console.error(`[EscrowManager] Failed to refund escrow ${escrowId}`);
      return false;
    }

    escrow.status = 'refunded';
    await redis.set(`${ESCROW_PREFIX}${escrowId}`, JSON.stringify(escrow));

    console.log(`[EscrowManager] Refunded escrow ${escrowId}`);
    return true;
  }

  /**
   * Get escrow by ID
   */
  async getEscrow(escrowId: string): Promise<EscrowTransaction | null> {
    const data = await redis.get(`${ESCROW_PREFIX}${escrowId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's escrows
   */
  async getUserEscrows(userId: string): Promise<{
    asBuyer: EscrowTransaction[];
    asSeller: EscrowTransaction[];
  }> {
    const buyerIds = await redis.smembers(`${ESCROW_PREFIX}buyer:${userId}`);
    const sellerIds = await redis.smembers(`${ESCROW_PREFIX}seller:${userId}`);

    const asBuyer = await Promise.all(
      buyerIds.map(id => this.getEscrow(id))
    );
    const asSeller = await Promise.all(
      sellerIds.map(id => this.getEscrow(id))
    );

    return {
      asBuyer: asBuyer.filter((e): e is EscrowTransaction => e !== null),
      asSeller: asSeller.filter((e): e is EscrowTransaction => e !== null)
    };
  }
}

// ============================================
// COIN MARKETPLACE ENGINE (MAIN)
// ============================================

export class CoinMarketplaceEngine {
  private balanceManager: CoinBalanceManager;
  private escrowManager: EscrowManager;

  constructor() {
    this.balanceManager = new CoinBalanceManager();
    this.escrowManager = new EscrowManager(this.balanceManager);
  }

  // ============================================
  // COIN PURCHASE
  // ============================================

  /**
   * Purchase REZ TRY coins with real money
   */
  async purchaseREZCoins(
    userId: string,
    amount: number,
    paymentId: string
  ): Promise<{
    success: boolean;
    purchaseId?: string;
    coinsAwarded?: number;
    error?: string;
  }> {
    // Validate amount
    if (amount < DEFAULT_CONFIG.MIN_LISTING_AMOUNT) {
      return { success: false, error: 'Minimum purchase amount is 10 coins' };
    }

    // Calculate price (₹10 = 100 coins → 1 coin = ₹0.10)
    const price = amount * DEFAULT_CONFIG.REZ_TRY_PRICE_PER_COIN;

    // In production, verify payment with payment gateway here
    // For now, we assume payment is verified by paymentId

    // Award coins
    const awarded = await this.balanceManager.addCoins(
      userId,
      'REZ_TRY',
      amount,
      `Purchased with payment ${paymentId}`
    );

    if (!awarded) {
      return { success: false, error: 'Failed to award coins' };
    }

    // Record purchase
    const purchaseId = uuidv4();
    await redis.set(
      `${MARKETPLACE_PREFIX}purchase:${purchaseId}`,
      JSON.stringify({
        id: purchaseId,
        userId,
        coinType: 'REZ_TRY',
        amount,
        price,
        paymentId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      })
    );

    // Update purchase count
    await redis.incr(`${MARKETPLACE_PREFIX}stats:daily:${new Date().toISOString().split('T')[0]}:purchases`);

    console.log(`[CoinMarketplace] User ${userId} purchased ${amount} REZ_TRY coins for ₹${price}`);
    return { success: true, purchaseId, coinsAwarded: amount };
  }

  /**
   * Purchase a bundle package
   */
  async purchaseBundle(
    userId: string,
    bundleName: string,
    paymentId: string
  ): Promise<{
    success: boolean;
    purchaseId?: string;
    coinsAwarded?: number;
    price?: number;
    error?: string;
  }> {
    const bundle = DEFAULT_CONFIG.BUNDLE_PACKAGES[bundleName as keyof typeof DEFAULT_CONFIG.BUNDLE_PACKAGES];

    if (!bundle) {
      return { success: false, error: `Bundle '${bundleName}' not found` };
    }

    // Award coins
    const awarded = await this.balanceManager.addCoins(
      userId,
      'REZ_TRY',
      bundle.coins,
      `Purchased ${bundleName} bundle`
    );

    if (!awarded) {
      return { success: false, error: 'Failed to award coins' };
    }

    // Record purchase
    const purchaseId = uuidv4();
    await redis.set(
      `${MARKETPLACE_PREFIX}purchase:${purchaseId}`,
      JSON.stringify({
        id: purchaseId,
        userId,
        coinType: 'REZ_TRY',
        amount: bundle.coins,
        price: bundle.price,
        bundleName,
        paymentId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      })
    );

    console.log(`[CoinMarketplace] User ${userId} purchased ${bundleName} bundle: ${bundle.coins} coins for ₹${bundle.price}`);
    return {
      success: true,
      purchaseId,
      coinsAwarded: bundle.coins,
      price: bundle.price
    };
  }

  /**
   * Purchase branded coins from a brand
   */
  async purchaseBrandCoins(
    userId: string,
    brandId: string,
    amount: number,
    paymentId: string
  ): Promise<{
    success: boolean;
    purchaseId?: string;
    coinsAwarded?: number;
    error?: string;
  }> {
    // Validate brand exists and has coins available
    const brandCoinsAvailable = await redis.get(`${COIN_PREFIX}brand:${brandId}:available`) || '0';

    if (parseInt(brandCoinsAvailable) < amount) {
      return { success: false, error: `Insufficient ${brandId} coins available` };
    }

    // Calculate price (same rate as REZ coins for simplicity)
    const price = amount * DEFAULT_CONFIG.REZ_TRY_PRICE_PER_COIN;

    // Deduct from brand pool and add to user
    const pipeline = redis.pipeline();
    pipeline.decrby(`${COIN_PREFIX}brand:${brandId}:available`, amount);
    pipeline.exec();

    await this.balanceManager.addCoins(
      userId,
      brandId,
      amount,
      `Purchased ${brandId} coins`
    );

    // Record purchase
    const purchaseId = uuidv4();
    await redis.set(
      `${MARKETPLACE_PREFIX}purchase:${purchaseId}`,
      JSON.stringify({
        id: purchaseId,
        userId,
        coinType: brandId,
        amount,
        price,
        paymentId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      })
    );

    console.log(`[CoinMarketplace] User ${userId} purchased ${amount} ${brandId} coins`);
    return { success: true, purchaseId, coinsAwarded: amount };
  }

  /**
   * Get available bundles
   */
  getAvailableBundles(): Array<{
    name: string;
    coins: number;
    price: number;
    pricePerCoin: number;
    discount: number;
  }> {
    const basePrice = DEFAULT_CONFIG.REZ_TRY_PRICE_PER_COIN;

    return Object.entries(DEFAULT_CONFIG.BUNDLE_PACKAGES).map(([name, bundle]) => {
      const regularPrice = bundle.coins * basePrice;
      const discount = ((regularPrice - bundle.price) / regularPrice) * 100;

      return {
        name,
        coins: bundle.coins,
        price: bundle.price,
        pricePerCoin: bundle.price / bundle.coins,
        discount: Math.round(discount)
      };
    });
  }

  // ============================================
  // COIN GIFTING
  // ============================================

  /**
   * Gift coins to another user
   */
  async giftCoins(
    senderId: string,
    request: GiftRequest
  ): Promise<{
    success: boolean;
    giftId?: string;
    error?: string;
  }> {
    const { recipientId, coinType, amount, message } = request;

    // Validate recipient
    if (senderId === recipientId) {
      return { success: false, error: 'Cannot gift coins to yourself' };
    }

    if (amount < 1) {
      return { success: false, error: 'Minimum gift amount is 1 coin' };
    }

    // Check rate limit
    const todayGifts = await redis.get(`${GIFT_PREFIX}daily:${senderId}:${new Date().toISOString().split('T')[0]}`) || '0';
    if (parseInt(todayGifts) >= DEFAULT_CONFIG.MAX_GIFTS_PER_DAY) {
      return { success: false, error: 'Daily gift limit reached' };
    }

    // Deduct from sender
    const deducted = await this.balanceManager.deductCoins(
      senderId,
      coinType,
      amount,
      `Gift to ${recipientId}`
    );

    if (!deducted) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Create gift record
    const giftId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const gift: CoinGifting = {
      id: giftId,
      senderId,
      recipientId,
      coinType,
      amount,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    await redis.set(`${GIFT_PREFIX}${giftId}`, JSON.stringify(gift));
    await redis.lpush(`${GIFT_PREFIX}recipient:${recipientId}`, giftId);

    // Increment daily gift count
    await redis.incr(`${GIFT_PREFIX}daily:${senderId}:${new Date().toISOString().split('T')[0]}`);

    // Queue gift delivery
    await redis.lpush(`${GIFT_PREFIX}pending`, giftId);

    console.log(`[CoinMarketplace] Gift ${giftId}: ${amount} ${coinType} from ${senderId} to ${recipientId}`);
    return { success: true, giftId };
  }

  /**
   * Claim a pending gift
   */
  async claimGift(
    recipientId: string,
    giftId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const giftData = await redis.get(`${GIFT_PREFIX}${giftId}`);
    if (!giftData) {
      return { success: false, error: 'Gift not found' };
    }

    const gift: CoinGifting = JSON.parse(giftData);

    if (gift.recipientId !== recipientId) {
      return { success: false, error: 'This gift is not for you' };
    }

    if (gift.status !== 'pending') {
      return { success: false, error: `Gift already ${gift.status}` };
    }

    // Check expiry
    if (new Date(gift.expiresAt) < new Date()) {
      gift.status = 'expired';
      await redis.set(`${GIFT_PREFIX}${giftId}`, JSON.stringify(gift));

      // Return coins to sender
      await this.balanceManager.addCoins(
        gift.senderId,
        gift.coinType,
        gift.amount,
        'Gift expired - returned'
      );

      return { success: false, error: 'Gift has expired' };
    }

    // Transfer coins to recipient
    const transferred = await this.balanceManager.transferCoins(
      gift.senderId,
      recipientId,
      gift.coinType,
      gift.amount,
      `Gift claimed: ${giftId}`
    );

    if (!transferred) {
      return { success: false, error: 'Failed to transfer coins' };
    }

    gift.status = 'claimed';
    gift.transactionId = uuidv4();
    await redis.set(`${GIFT_PREFIX}${giftId}`, JSON.stringify(gift));

    console.log(`[CoinMarketplace] Gift ${giftId} claimed by ${recipientId}`);
    return { success: true };
  }

  /**
   * Get pending gifts for user
   */
  async getPendingGifts(userId: string): Promise<CoinGifting[]> {
    const giftIds = await redis.lrange(`${GIFT_PREFIX}recipient:${userId}`, 0, -1);
    const gifts: CoinGifting[] = [];

    for (const giftId of giftIds) {
      const giftData = await redis.get(`${GIFT_PREFIX}${giftId}`);
      if (giftData) {
        const gift: CoinGifting = JSON.parse(giftData);
        if (gift.status === 'pending') {
          gifts.push(gift);
        }
      }
    }

    return gifts;
  }

  /**
   * Cancel a gift (sender only)
   */
  async cancelGift(
    senderId: string,
    giftId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const giftData = await redis.get(`${GIFT_PREFIX}${giftId}`);
    if (!giftData) {
      return { success: false, error: 'Gift not found' };
    }

    const gift: CoinGifting = JSON.parse(giftData);

    if (gift.senderId !== senderId) {
      return { success: false, error: 'You can only cancel your own gifts' };
    }

    if (gift.status !== 'pending') {
      return { success: false, error: `Gift already ${gift.status}` };
    }

    // Return coins to sender
    await this.balanceManager.addCoins(
      senderId,
      gift.coinType,
      gift.amount,
      'Gift cancelled - refunded'
    );

    gift.status = 'cancelled';
    await redis.set(`${GIFT_PREFIX}${giftId}`, JSON.stringify(gift));

    console.log(`[CoinMarketplace] Gift ${giftId} cancelled by ${senderId}`);
    return { success: true };
  }

  // ============================================
  // COIN EXCHANGE
  // ============================================

  /**
   * Exchange brand coins to REZ coins
   */
  async exchangeCoins(
    userId: string,
    request: ExchangeRequest
  ): Promise<{
    success: boolean;
    exchangeId?: string;
    fromAmount?: number;
    toAmount?: number;
    exchangeRate?: number;
    fee?: number;
    error?: string;
  }> {
    const { fromCoinType, fromAmount, toCoinType = 'REZ' } = request;

    // Validate
    if (fromAmount < 10) {
      return { success: false, error: 'Minimum exchange amount is 10 coins' };
    }

    if (['REZ', 'REZ_TRY'].includes(fromCoinType)) {
      return { success: false, error: 'Cannot exchange REZ or REZ_TRY coins' };
    }

    // Check rate limit
    const todayExchanges = await redis.get(
      `${EXCHANGE_PREFIX}daily:${userId}:${new Date().toISOString().split('T')[0]}`
    ) || '0';
    if (parseInt(todayExchanges) >= DEFAULT_CONFIG.MAX_EXCHANGES_PER_DAY) {
      return { success: false, error: 'Daily exchange limit reached' };
    }

    // Get exchange rate
    const exchangeRate = DEFAULT_CONFIG.BRAND_EXCHANGE_RATES[fromCoinType as keyof typeof DEFAULT_CONFIG.BRAND_EXCHANGE_RATES]
      || DEFAULT_CONFIG.BRAND_EXCHANGE_RATES.DEFAULT;

    // Calculate amounts
    const toAmount = Math.floor(fromAmount * exchangeRate);
    const fee = Math.floor(toAmount * DEFAULT_CONFIG.EXCHANGE_FEE_PERCENT / 100);
    const netAmount = toAmount - fee;

    // Deduct source coins
    const deducted = await this.balanceManager.deductCoins(
      userId,
      fromCoinType,
      fromAmount,
      `Exchange to ${toCoinType}`
    );

    if (!deducted) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Award destination coins
    const awarded = await this.balanceManager.addCoins(
      userId,
      toCoinType,
      netAmount,
      `Exchange from ${fromCoinType} (${exchangeRate * 100}% rate)`
    );

    if (!awarded) {
      // Rollback
      await this.balanceManager.addCoins(userId, fromCoinType, fromAmount, 'Exchange failed - rollback');
      return { success: false, error: 'Exchange failed' };
    }

    // Record exchange
    const exchangeId = uuidv4();
    const exchange: CoinExchange = {
      id: exchangeId,
      userId,
      fromCoinType,
      fromAmount,
      toCoinType,
      toAmount: netAmount,
      exchangeRate,
      fee,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    await redis.set(`${EXCHANGE_PREFIX}${exchangeId}`, JSON.stringify(exchange));
    await redis.lpush(`${EXCHANGE_PREFIX}user:${userId}`, exchangeId);

    // Increment daily count
    await redis.incr(`${EXCHANGE_PREFIX}daily:${userId}:${new Date().toISOString().split('T')[0]}`);

    console.log(`[CoinMarketplace] Exchange ${exchangeId}: ${fromAmount} ${fromCoinType} → ${netAmount} ${toCoinType} at ${exchangeRate * 100}%`);
    return {
      success: true,
      exchangeId,
      fromAmount,
      toAmount: netAmount,
      exchangeRate,
      fee
    };
  }

  /**
   * Get exchange rate preview
   */
  getExchangeRate(
    fromCoinType: string,
    fromAmount: number
  ): {
    fromCoinType: string;
    fromAmount: number;
    toCoinType: string;
    toAmount: number;
    exchangeRate: number;
    fee: number;
    netAmount: number;
  } {
    const exchangeRate = DEFAULT_CONFIG.BRAND_EXCHANGE_RATES[fromCoinType as keyof typeof DEFAULT_CONFIG.BRAND_EXCHANGE_RATES]
      || DEFAULT_CONFIG.BRAND_EXCHANGE_RATES.DEFAULT;

    const toAmount = Math.floor(fromAmount * exchangeRate);
    const fee = Math.floor(toAmount * DEFAULT_CONFIG.EXCHANGE_FEE_PERCENT / 100);

    return {
      fromCoinType,
      fromAmount,
      toCoinType: 'REZ',
      toAmount,
      exchangeRate,
      fee,
      netAmount: toAmount - fee
    };
  }

  /**
   * Get user's exchange history
   */
  async getExchangeHistory(userId: string, limit: number = 20): Promise<CoinExchange[]> {
    const exchangeIds = await redis.lrange(`${EXCHANGE_PREFIX}user:${userId}`, 0, limit - 1);
    const exchanges: CoinExchange[] = [];

    for (const id of exchangeIds) {
      const data = await redis.get(`${EXCHANGE_PREFIX}${id}`);
      if (data) {
        exchanges.push(JSON.parse(data));
      }
    }

    return exchanges;
  }

  // ============================================
  // MARKETPLACE LISTINGS
  // ============================================

  /**
   * Create a marketplace listing
   */
  async createListing(
    sellerId: string,
    request: ListingRequest
  ): Promise<{
    success: boolean;
    listingId?: string;
    error?: string;
  }> {
    const { coinType, amount, pricePerCoin, durationHours = 72 } = request;

    // Validate amount
    if (amount < DEFAULT_CONFIG.MIN_LISTING_AMOUNT || amount > DEFAULT_CONFIG.MAX_LISTING_AMOUNT) {
      return {
        success: false,
        error: `Amount must be between ${DEFAULT_CONFIG.MIN_LISTING_AMOUNT} and ${DEFAULT_CONFIG.MAX_LISTING_AMOUNT}`
      };
    }

    // Validate price
    if (pricePerCoin <= 0) {
      return { success: false, error: 'Price per coin must be positive' };
    }

    // Check user listings limit
    const userListings = await redis.scard(`${MARKETPLACE_PREFIX}user:${sellerId}:listings`);
    if (userListings >= DEFAULT_CONFIG.MAX_LISTINGS_PER_USER) {
      return { success: false, error: 'Maximum listings limit reached' };
    }

    // Deduct coins from seller (escrow)
    const deducted = await this.balanceManager.deductCoins(
      sellerId,
      coinType,
      amount,
      `Listed for sale: ${amount} ${coinType}`
    );

    if (!deducted) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Create listing
    const listingId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const listing: CoinListing = {
      id: listingId,
      sellerId,
      coinType,
      amount,
      pricePerCoin,
      totalPrice: amount * pricePerCoin,
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    // Store listing
    await redis.set(`${MARKETPLACE_PREFIX}listing:${listingId}`, JSON.stringify(listing));
    await redis.sadd(`${MARKETPLACE_PREFIX}user:${sellerId}:listings`, listingId);
    await redis.sadd(`${MARKETPLACE_PREFIX}active`, listingId);

    // Index by coin type for discovery
    await redis.zadd(
      `${MARKETPLACE_PREFIX}type:${coinType}`,
      listing.totalPrice,
      listingId
    );

    console.log(`[CoinMarketplace] Created listing ${listingId}: ${amount} ${coinType} for ${listing.totalPrice}`);
    return { success: true, listingId };
  }

  /**
   * Purchase from a listing
   */
  async purchaseListing(
    buyerId: string,
    listingId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    purchase?: CoinPurchase;
    escrowId?: string;
    error?: string;
  }> {
    const listingData = await redis.get(`${MARKETPLACE_PREFIX}listing:${listingId}`);
    if (!listingData) {
      return { success: false, error: 'Listing not found' };
    }

    const listing: CoinListing = JSON.parse(listingData);

    if (listing.status !== 'active') {
      return { success: false, error: 'Listing is not active' };
    }

    if (listing.sellerId === buyerId) {
      return { success: false, error: 'Cannot purchase your own listing' };
    }

    // Check expiry
    if (listing.expiresAt && new Date(listing.expiresAt) < new Date()) {
      listing.status = 'cancelled';
      await redis.set(`${MARKETPLACE_PREFIX}listing:${listingId}`, JSON.stringify(listing));
      return { success: false, error: 'Listing has expired' };
    }

    // Determine purchase amount
    const purchaseAmount = amount || listing.amount;
    if (purchaseAmount > listing.amount) {
      return { success: false, error: 'Purchase amount exceeds listing amount' };
    }

    const totalPrice = purchaseAmount * listing.pricePerCoin;
    const fee = totalPrice * DEFAULT_CONFIG.MARKETPLACE_FEE_PERCENT / 100;
    const totalWithFee = totalPrice + fee;

    // Create escrow (coins already held from listing creation)
    const escrow = await this.escrowManager.createEscrow(
      listingId,
      listing.sellerId,
      buyerId,
      listing.coinType,
      purchaseAmount,
      totalPrice
    );

    // Record purchase
    const purchaseId = uuidv4();
    const purchase: CoinPurchase = {
      id: purchaseId,
      listingId,
      buyerId,
      amount: purchaseAmount,
      totalPrice,
      paymentId: escrow.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await redis.set(`${MARKETPLACE_PREFIX}purchase:${purchaseId}`, JSON.stringify(purchase));
    await redis.lpush(`${MARKETPLACE_PREFIX}listing:${listingId}:purchases`, purchaseId);

    console.log(`[CoinMarketplace] Purchase ${purchaseId}: ${purchaseAmount} ${listing.coinType} for ${totalPrice}`);
    return { success: true, purchase, escrowId: escrow.id };
  }

  /**
   * Complete a purchase (after payment verification)
   */
  async completePurchase(purchaseId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const purchaseData = await redis.get(`${MARKETPLACE_PREFIX}purchase:${purchaseId}`);
    if (!purchaseData) {
      return { success: false, error: 'Purchase not found' };
    }

    const purchase: CoinPurchase = JSON.parse(purchaseData);

    if (purchase.status !== 'pending') {
      return { success: false, error: `Purchase already ${purchase.status}` };
    }

    // Release escrow to transfer coins
    const released = await this.escrowManager.releaseEscrow(purchase.paymentId);
    if (!released) {
      return { success: false, error: 'Failed to release escrow' };
    }

    // Update purchase status
    purchase.status = 'completed';
    purchase.completedAt = new Date().toISOString();
    await redis.set(`${MARKETPLACE_PREFIX}purchase:${purchaseId}`, JSON.stringify(purchase));

    // Update listing
    const listingData = await redis.get(`${MARKETPLACE_PREFIX}listing:${purchase.listingId}`);
    if (listingData) {
      const listing: CoinListing = JSON.parse(listingData);
      listing.amount -= purchase.amount;
      listing.updatedAt = new Date().toISOString();

      if (listing.amount <= 0) {
        listing.status = 'sold';
        await redis.srem(`${MARKETPLACE_PREFIX}active`, listing.id);
      }

      await redis.set(`${MARKETPLACE_PREFIX}listing:${listing.id}`, JSON.stringify(listing));
    }

    console.log(`[CoinMarketplace] Completed purchase ${purchaseId}`);
    return { success: true };
  }

  /**
   * Cancel a listing
   */
  async cancelListing(
    sellerId: string,
    listingId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const listingData = await redis.get(`${MARKETPLACE_PREFIX}listing:${listingId}`);
    if (!listingData) {
      return { success: false, error: 'Listing not found' };
    }

    const listing: CoinListing = JSON.parse(listingData);

    if (listing.sellerId !== sellerId) {
      return { success: false, error: 'You can only cancel your own listings' };
    }

    if (listing.status !== 'active') {
      return { success: false, error: `Listing already ${listing.status}` };
    }

    // Return coins to seller
    await this.balanceManager.addCoins(
      sellerId,
      listing.coinType,
      listing.amount,
      `Listing cancelled: ${listingId}`
    );

    // Update listing
    listing.status = 'cancelled';
    listing.updatedAt = new Date().toISOString();
    await redis.set(`${MARKETPLACE_PREFIX}listing:${listingId}`, JSON.stringify(listing));

    // Remove from active
    await redis.srem(`${MARKETPLACE_PREFIX}active`, listingId);
    await redis.srem(`${MARKETPLACE_PREFIX}user:${sellerId}:listings`, listingId);

    console.log(`[CoinMarketplace] Cancelled listing ${listingId}`);
    return { success: true };
  }

  /**
   * Search listings
   */
  async searchListings(params: {
    coinType?: string;
    minAmount?: number;
    maxAmount?: number;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'price_asc' | 'price_desc' | 'amount_asc' | 'amount_desc' | 'recent';
    limit?: number;
    offset?: number;
  }): Promise<{
    listings: CoinListing[];
    total: number;
  }> {
    const {
      coinType,
      minAmount,
      maxAmount,
      minPrice,
      maxPrice,
      sortBy = 'recent',
      limit = 20,
      offset = 0
    } = params;

    // Get active listing IDs
    let listingIds = await redis.smembers(`${MARKETPLACE_PREFIX}active`);

    // Filter by coin type
    if (coinType) {
      listingIds = listingIds.filter(id =>
        redis.get(`${MARKETPLACE_PREFIX}listing:${id}`).then(data => {
          if (!data) return false;
          return JSON.parse(data).coinType === coinType;
        }).catch(() => false)
      );
    }

    // Fetch and filter listings
    const allListings: CoinListing[] = [];
    for (const id of listingIds) {
      const data = await redis.get(`${MARKETPLACE_PREFIX}listing:${id}`);
      if (data) {
        const listing: CoinListing = JSON.parse(data);

        // Apply filters
        if (minAmount && listing.amount < minAmount) continue;
        if (maxAmount && listing.amount > maxAmount) continue;
        if (minPrice && listing.totalPrice < minPrice) continue;
        if (maxPrice && listing.totalPrice > maxPrice) continue;
        if (listing.expiresAt && new Date(listing.expiresAt) < new Date()) continue;

        allListings.push(listing);
      }
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        allListings.sort((a, b) => a.pricePerCoin - b.pricePerCoin);
        break;
      case 'price_desc':
        allListings.sort((a, b) => b.pricePerCoin - a.pricePerCoin);
        break;
      case 'amount_asc':
        allListings.sort((a, b) => a.amount - b.amount);
        break;
      case 'amount_desc':
        allListings.sort((a, b) => b.amount - a.amount);
        break;
      case 'recent':
      default:
        allListings.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    // Paginate
    const total = allListings.length;
    const listings = allListings.slice(offset, offset + limit);

    return { listings, total };
  }

  /**
   * Get listing by ID
   */
  async getListing(listingId: string): Promise<CoinListing | null> {
    const data = await redis.get(`${MARKETPLACE_PREFIX}listing:${listingId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's listings
   */
  async getUserListings(userId: string): Promise<CoinListing[]> {
    const listingIds = await redis.smembers(`${MARKETPLACE_PREFIX}user:${userId}:listings`);
    const listings: CoinListing[] = [];

    for (const id of listingIds) {
      const data = await redis.get(`${MARKETPLACE_PREFIX}listing:${id}`);
      if (data) {
        listings.push(JSON.parse(data));
      }
    }

    return listings;
  }

  /**
   * Get user's purchases
   */
  async getUserPurchases(userId: string, limit: number = 20): Promise<CoinPurchase[]> {
    const keys = await redis.keys(`${MARKETPLACE_PREFIX}purchase:*`);
    const purchases: CoinPurchase[] = [];

    for (const key of keys.slice(0, 100)) {
      const data = await redis.get(key);
      if (data) {
        const purchase: CoinPurchase = JSON.parse(data);
        if (purchase.buyerId === userId) {
          purchases.push(purchase);
        }
      }
    }

    return purchases.slice(0, limit);
  }

  // ============================================
  // PRICE DISCOVERY
  // ============================================

  /**
   * Get market statistics for a coin type
   */
  async getMarketStats(coinType: string): Promise<{
    coinType: string;
    activeListings: number;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    totalVolume: number;
    volume24h: number;
  }> {
    const listingIds = await redis.smembers(`${MARKETPLACE_PREFIX}active`);
    let totalVolume = 0;
    let volume24h = 0;
    let sum = 0;
    let count = 0;
    let lowest = Infinity;
    let highest = 0;

    for (const id of listingIds) {
      const data = await redis.get(`${MARKETPLACE_PREFIX}listing:${id}`);
      if (data) {
        const listing: CoinListing = JSON.parse(data);
        if (listing.coinType === coinType) {
          totalVolume += listing.amount;
          sum += listing.pricePerCoin;
          count++;
          lowest = Math.min(lowest, listing.pricePerCoin);
          highest = Math.max(highest, listing.pricePerCoin);

          // 24h volume
          const createdAt = new Date(listing.createdAt).getTime();
          const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
          if (createdAt > dayAgo) {
            volume24h += listing.amount;
          }
        }
      }
    }

    return {
      coinType,
      activeListings: count,
      lowestPrice: count > 0 ? lowest : 0,
      highestPrice: count > 0 ? highest : 0,
      averagePrice: count > 0 ? sum / count : 0,
      totalVolume,
      volume24h
    };
  }

  /**
   * Get recommended price based on market
   */
  async getRecommendedPrice(coinType: string): Promise<{
    recommended: number;
    floor: number;
    ceiling: number;
    basedOn: number;
  }> {
    const stats = await this.getMarketStats(coinType);

    if (stats.activeListings === 0) {
      // No market data, use exchange rate as baseline
      const exchangeRate = DEFAULT_CONFIG.BRAND_EXCHANGE_RATES[coinType as keyof typeof DEFAULT_CONFIG.BRAND_EXCHANGE_RATES]
        || DEFAULT_CONFIG.BRAND_EXCHANGE_RATES.DEFAULT;
      const basePrice = DEFAULT_CONFIG.REZ_TRY_PRICE_PER_COIN * exchangeRate;

      return {
        recommended: basePrice,
        floor: basePrice * 0.8,
        ceiling: basePrice * 1.2,
        basedOn: 0
      };
    }

    return {
      recommended: stats.averagePrice,
      floor: stats.lowestPrice,
      ceiling: stats.highestPrice,
      basedOn: stats.activeListings
    };
  }

  // ============================================
  // DISPUTE MANAGEMENT
  // ============================================

  /**
   * Raise a dispute on a purchase
   */
  async raiseDispute(
    userId: string,
    purchaseId: string,
    reason: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const purchaseData = await redis.get(`${MARKETPLACE_PREFIX}purchase:${purchaseId}`);
    if (!purchaseData) {
      return { success: false, error: 'Purchase not found' };
    }

    const purchase: CoinPurchase = JSON.parse(purchaseData);

    if (purchase.buyerId !== userId && purchase.listingId) {
      const listingData = await redis.get(`${MARKETPLACE_PREFIX}listing:${purchase.listingId}`);
      if (listingData) {
        const listing: CoinListing = JSON.parse(listingData);
        if (listing.sellerId !== userId) {
          return { success: false, error: 'You are not authorized to dispute this purchase' };
        }
      }
    }

    // Raise escrow dispute
    const disputed = await this.escrowManager.raiseDispute(purchase.paymentId, reason);
    if (!disputed) {
      return { success: false, error: 'Failed to raise dispute' };
    }

    // Update purchase status
    purchase.status = 'disputed';
    await redis.set(`${MARKETPLACE_PREFIX}purchase:${purchaseId}`, JSON.stringify(purchase));

    console.log(`[CoinMarketplace] Dispute raised on purchase ${purchaseId}: ${reason}`);
    return { success: true };
  }

  /**
   * Resolve a dispute (admin only)
   */
  async resolveDispute(
    escrowId: string,
    resolution: 'refund_buyer' | 'release_seller'
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const escrow = await this.escrowManager.getEscrow(escrowId);
    if (!escrow) {
      return { success: false, error: 'Escrow not found' };
    }

    if (escrow.status !== 'disputed') {
      return { success: false, error: 'Escrow is not in disputed status' };
    }

    if (resolution === 'refund_buyer') {
      await this.escrowManager.refundEscrow(escrowId);
    } else {
      await this.escrowManager.releaseEscrow(escrowId);
    }

    return { success: true };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get user balance
   */
  async getBalance(userId: string): Promise<CoinBalance> {
    return this.balanceManager.getBalance(userId);
  }

  /**
   * Get balance manager (for internal use)
   */
  getBalanceManager(): CoinBalanceManager {
    return this.balanceManager;
  }

  /**
   * Get marketplace stats
   */
  async getMarketplaceStats(): Promise<{
    totalListings: number;
    totalVolume24h: number;
    totalPurchases: number;
    totalGifts: number;
    totalExchanges: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [activeListings, purchases, gifts, exchanges] = await Promise.all([
      redis.scard(`${MARKETPLACE_PREFIX}active`),
      redis.get(`${MARKETPLACE_PREFIX}stats:daily:${today}:purchases`),
      redis.get(`${GIFT_PREFIX}stats:daily:${today}`),
      redis.get(`${EXCHANGE_PREFIX}stats:daily:${today}`)
    ]);

    return {
      totalListings: activeListings,
      totalVolume24h: 0, // Would need more complex calculation
      totalPurchases: parseInt(purchases || '0'),
      totalGifts: parseInt(gifts || '0'),
      totalExchanges: parseInt(exchanges || '0')
    };
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export const coinMarketplaceEngine = new CoinMarketplaceEngine();

export async function purchaseREZCoins(
  userId: string,
  amount: number,
  paymentId: string
) {
  return coinMarketplaceEngine.purchaseREZCoins(userId, amount, paymentId);
}

export async function giftCoins(
  senderId: string,
  request: GiftRequest
) {
  return coinMarketplaceEngine.giftCoins(senderId, request);
}

export async function exchangeCoins(
  userId: string,
  request: ExchangeRequest
) {
  return coinMarketplaceEngine.exchangeCoins(userId, request);
}

export async function createListing(
  sellerId: string,
  request: ListingRequest
) {
  return coinMarketplaceEngine.createListing(sellerId, request);
}

export async function purchaseListing(
  buyerId: string,
  listingId: string,
  amount?: number
) {
  return coinMarketplaceEngine.purchaseListing(buyerId, listingId, amount);
}

export async function getBalance(userId: string) {
  return coinMarketplaceEngine.getBalance(userId);
}

export async function getMarketStats(coinType: string) {
  return coinMarketplaceEngine.getMarketStats(coinType);
}

export default CoinMarketplaceEngine;
