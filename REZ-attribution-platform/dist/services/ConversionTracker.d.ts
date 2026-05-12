import { IConversion, ConversionType, ConversionStatus } from '../models/Conversion';
type LeanConversion = Omit<IConversion, 'save' | 'delete' | 'validate'>;
export interface CreateConversionDTO {
    userId: string;
    sessionId: string;
    type: ConversionType;
    merchantId: string;
    storeId?: string;
    orderId?: string;
    value?: number;
    currency?: string;
    items?: Array<{
        productId: string;
        name: string;
        quantity: number;
        price: number;
        category?: string;
    }>;
    location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    metadata?: Record<string, unknown>;
    conversionTimestamp?: Date;
}
export interface ConversionQueryOptions {
    userId?: string;
    merchantId?: string;
    storeId?: string;
    type?: ConversionType;
    status?: ConversionStatus;
    startDate?: Date;
    endDate?: Date;
    minValue?: number;
    maxValue?: number;
    limit?: number;
    skip?: number;
}
export interface ConversionStats {
    totalConversions: number;
    totalValue: number;
    averageValue: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    uniqueUsers: number;
    conversionRate?: number;
}
export declare class ConversionTracker {
    /**
     * Create a new conversion
     */
    createConversion(data: CreateConversionDTO): Promise<IConversion>;
    /**
     * Get conversion by ID
     */
    getConversion(conversionId: string): Promise<LeanConversion | null>;
    /**
     * Get conversions with filtering options
     */
    getConversions(options: ConversionQueryOptions): Promise<{
        conversions: LeanConversion[];
        total: number;
    }>;
    /**
     * Get conversions for a user
     */
    getUserConversions(userId: string): Promise<LeanConversion[]>;
    /**
     * Get conversions by merchant
     */
    getMerchantConversions(merchantId: string, startDate?: Date, endDate?: Date): Promise<LeanConversion[]>;
    /**
     * Update conversion status
     */
    updateConversionStatus(conversionId: string, status: ConversionStatus): Promise<LeanConversion | null>;
    /**
     * Add attribution data to a conversion
     */
    addAttributionData(conversionId: string, attributionData: {
        touchpointIds: string[];
        attributionModel: string;
        attributedChannel: string;
        attributedCampaignId?: string;
    }): Promise<LeanConversion | null>;
    /**
     * Get conversion statistics
     */
    getConversionStats(merchantId?: string, startDate?: Date, endDate?: Date): Promise<ConversionStats>;
    /**
     * Get recent conversions for a merchant
     */
    getRecentConversions(merchantId: string, limit?: number): Promise<LeanConversion[]>;
    /**
     * Delete conversion by ID
     */
    deleteConversion(conversionId: string): Promise<boolean>;
    /**
     * Batch create conversions
     */
    createConversionsBatch(data: CreateConversionDTO[]): Promise<LeanConversion[]>;
    /**
     * Get conversions by order ID
     */
    getConversionsByOrderId(orderId: string): Promise<LeanConversion[]>;
    /**
     * Track refund
     */
    processRefund(conversionId: string): Promise<LeanConversion | null>;
}
export declare const conversionTracker: ConversionTracker;
export {};
//# sourceMappingURL=ConversionTracker.d.ts.map