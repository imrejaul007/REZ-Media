/**
 * Wallet Service - Full Wallet Operations
 * Handles wallet balance, credits, debits, and transaction history
 */

import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  ITransaction,
} from '../models/Transaction';
import { WalletBalance, WalletTransaction } from '../types/razorpay';

// ============================================================================
// Wallet Document Interface
// ============================================================================

interface IWallet extends Document {
  merchantId: string;
  balance: number;
  currency: string;
  reservedBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    merchantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    reservedBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'wallets',
  }
);

// Virtual for available balance (total - reserved)
WalletSchema.virtual('availableBalance').get(function () {
  return this.balance - this.reservedBalance;
});

const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or create wallet for merchant
 */
async function getOrCreateWallet(merchantId: string): Promise<IWallet> {
  let wallet = await Wallet.findOne({ merchantId });

  if (!wallet) {
    wallet = new Wallet({
      merchantId,
      balance: 0,
      currency: 'INR',
      reservedBalance: 0,
    });
    await wallet.save();
  }

  return wallet;
}

/**
 * Update wallet balance with optimistic locking
 */
async function updateWalletBalance(
  merchantId: string,
  amountDelta: number,
  maxRetries: number = 3
): Promise<{ wallet: IWallet; newBalance: number }> {
  let attempts = 0;

  while (attempts < maxRetries) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await Wallet.findOne({ merchantId }).session(session);

      if (!wallet) {
        throw new Error(`Wallet not found for merchant: ${merchantId}`);
      }

      const newBalance = wallet.balance + amountDelta;

      if (newBalance < 0) {
        throw new Error(`Insufficient balance. Current: ${wallet.balance}, Required: ${Math.abs(amountDelta)}`);
      }

      wallet.balance = newBalance;
      await wallet.save({ session });

      await session.commitTransaction();
      session.endSession();

      return { wallet, newBalance };
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();

      // If it's a write conflict, retry
      if (error.code === 112 && attempts < maxRetries - 1) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 50 * attempts)); // Exponential backoff
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to update wallet balance after max retries');
}

// ============================================================================
// Wallet Service
// ============================================================================

export class WalletService {
  /**
   * Get wallet balance for a merchant
   */
  async getBalance(merchantId: string): Promise<number> {
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }

    const wallet = await getOrCreateWallet(merchantId);
    return wallet.balance;
  }

  /**
   * Get full wallet details
   */
  async getWalletDetails(merchantId: string): Promise<WalletBalance> {
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }

    const wallet = await getOrCreateWallet(merchantId);

    return {
      merchantId: wallet.merchantId,
      balance: wallet.balance,
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Credit wallet with amount
   */
  async creditWallet(
    merchantId: string,
    amount: number,
    reference: string,
    description?: string
  ): Promise<{ balance: number; transactionId: string }> {
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }
    if (!amount || amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!reference) {
      throw new Error('Reference is required for wallet credit');
    }

    // Check for duplicate transaction
    const existingTransaction = await Transaction.findOne({
      merchantId,
      'metadata.reference': reference,
      type: TransactionType.WALLET_TOPUP,
    });

    if (existingTransaction && existingTransaction.status === TransactionStatus.COMPLETED) {
      console.warn(`Duplicate credit attempt for reference: ${reference}`);
      return {
        balance: existingTransaction.metadata.balanceAfter || await this.getBalance(merchantId),
        transactionId: existingTransaction.transactionId,
      };
    }

    // Update wallet balance
    const { newBalance } = await updateWalletBalance(merchantId, amount);

    // Create transaction record
    const transactionId = `wt_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const transaction = new Transaction({
      transactionId,
      merchantId,
      type: TransactionType.WALLET_TOPUP,
      amount,
      currency: 'INR',
      status: TransactionStatus.COMPLETED,
      metadata: {
        reference,
        description,
        balanceAfter: newBalance,
        previousBalance: newBalance - amount,
      },
      completedAt: new Date(),
    });
    await transaction.save();

    // Emit event for external services (if using event emitter)
    // eventEmitter.emit('wallet.credited', { merchantId, amount, transactionId });

    return {
      balance: newBalance,
      transactionId,
    };
  }

  /**
   * Debit wallet with amount
   */
  async debitWallet(
    merchantId: string,
    amount: number,
    reference: string,
    description?: string
  ): Promise<{ balance: number; transactionId: string }> {
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }
    if (!amount || amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!reference) {
      throw new Error('Reference is required for wallet debit');
    }

    // Check for duplicate transaction
    const existingTransaction = await Transaction.findOne({
      merchantId,
      'metadata.reference': reference,
      type: TransactionType.PAYOUT,
    });

    if (existingTransaction && existingTransaction.status === TransactionStatus.COMPLETED) {
      console.warn(`Duplicate debit attempt for reference: ${reference}`);
      return {
        balance: existingTransaction.metadata.balanceAfter || await this.getBalance(merchantId),
        transactionId: existingTransaction.transactionId,
      };
    }

    // Update wallet balance (negative delta)
    const { newBalance } = await updateWalletBalance(merchantId, -amount);

    // Create transaction record
    const transactionId = `wd_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const transaction = new Transaction({
      transactionId,
      merchantId,
      type: TransactionType.PAYOUT,
      amount,
      currency: 'INR',
      status: TransactionStatus.COMPLETED,
      metadata: {
        reference,
        description,
        balanceAfter: newBalance,
        previousBalance: newBalance + amount,
      },
      completedAt: new Date(),
    });
    await transaction.save();

    // Emit event for external services
    // eventEmitter.emit('wallet.debited', { merchantId, amount, transactionId });

    return {
      balance: newBalance,
      transactionId,
    };
  }

  /**
   * Reserve balance for pending operation (e.g., ad campaign)
   */
  async reserveBalance(
    merchantId: string,
    amount: number,
    reference: string
  ): Promise<{ availableBalance: number; reservationId: string }> {
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }
    if (!amount || amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await getOrCreateWallet(merchantId);
    const availableBalance = wallet.balance - wallet.reservedBalance;

    if (availableBalance < amount) {
      throw new Error(`Insufficient available balance. Available: ${availableBalance}, Required: ${amount}`);
    }

    wallet.reservedBalance += amount;
    await wallet.save();

    const reservationId = `rsv_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Create a pending transaction for the reservation
    const transaction = new Transaction({
      transactionId: reservationId,
      merchantId,
      type: TransactionType.AD_PAYMENT,
      amount,
      currency: 'INR',
      status: TransactionStatus.PENDING,
      metadata: {
        reservation: true,
        reference,
        reservedAt: new Date(),
      },
    });
    await transaction.save();

    return {
      availableBalance: wallet.balance - wallet.reservedBalance,
      reservationId,
    };
  }

  /**
   * Release reserved balance
   */
  async releaseReservation(
    merchantId: string,
    reservationId: string
  ): Promise<{ balance: number; releasedAmount: number }> {
    const transaction = await Transaction.findOne({
      transactionId: reservationId,
      merchantId,
      'metadata.reservation': true,
    });

    if (!transaction) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error(`Reservation already processed: ${transaction.status}`);
    }

    const wallet = await Wallet.findOne({ merchantId });
    if (!wallet) {
      throw new Error(`Wallet not found for merchant: ${merchantId}`);
    }

    const releasedAmount = transaction.amount;
    wallet.reservedBalance = Math.max(0, wallet.reservedBalance - releasedAmount);
    await wallet.save();

    transaction.status = TransactionStatus.CANCELLED;
    transaction.metadata.cancelledAt = new Date();
    transaction.metadata.cancellationReason = 'Reservation released';
    await transaction.save();

    return {
      balance: wallet.balance - wallet.reservedBalance,
      releasedAmount,
    };
  }

  /**
   * Get wallet transaction history
   */
  async getTransactions(
    merchantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: TransactionStatus;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    transactions: WalletTransaction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { page = 1, limit = 20, type, status, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const query: any = { merchantId };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = startDate;
      }
      if (endDate) {
        query.createdAt.$lte = endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    const walletTransactions: WalletTransaction[] = transactions.map((tx) => ({
      id: tx.transactionId,
      merchantId: tx.merchantId,
      type: tx.type === TransactionType.WALLET_TOPUP || tx.type === TransactionType.REFUND
        ? 'credit'
        : 'debit',
      amount: tx.amount,
      balanceAfter: tx.metadata?.balanceAfter || 0,
      reference: tx.metadata?.reference || tx.transactionId,
      description: tx.metadata?.description,
      createdAt: tx.createdAt,
    }));

    return {
      transactions: walletTransactions,
      total,
      page,
      limit,
      hasMore: skip + transactions.length < total,
    };
  }

  /**
   * Get summary statistics for a merchant
   */
  async getSummary(merchantId: string): Promise<{
    currentBalance: number;
    reservedBalance: number;
    availableBalance: number;
    totalCredits: number;
    totalDebits: number;
    totalTransactions: number;
  }> {
    const wallet = await getOrCreateWallet(merchantId);

    const summary = await Transaction.aggregate([
      { $match: { merchantId } },
      {
        $facet: {
          credits: [
            {
              $match: {
                type: { $in: [TransactionType.WALLET_TOPUP, TransactionType.REFUND] },
                status: TransactionStatus.COMPLETED,
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          debits: [
            {
              $match: {
                type: { $in: [TransactionType.PAYOUT, TransactionType.AD_PAYMENT] },
                status: TransactionStatus.COMPLETED,
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const credits = summary[0]?.credits[0] || { total: 0, count: 0 };
    const debits = summary[0]?.debits[0] || { total: 0, count: 0 };

    return {
      currentBalance: wallet.balance,
      reservedBalance: wallet.reservedBalance,
      availableBalance: wallet.balance - wallet.reservedBalance,
      totalCredits: credits.total,
      totalDebits: debits.total,
      totalTransactions: credits.count + debits.count,
    };
  }
}

export const walletService = new WalletService();
export default walletService;
