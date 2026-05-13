import { CRMDeal, ICRMDealDocument } from '../models/CRMDeal.js';
import { hubspotClient } from '../clients/hubspotClient.js';
import { zohoClient } from '../clients/zohoClient.js';
import { authService } from './authService.js';
import {
  CRMProvider,
  DealStage,
  DealQueryParams,
  CreateDealRequest,
  CRMDeal as ICRMDeal,
} from '../types/index.js';

export interface SyncDealsResult {
  success: boolean;
  synced: number;
  errors: number;
  errorDetails: Array<{ externalId: string; error: string }>;
}

export class DealService {
  private transformHubSpotDeal(hsDeal: { id: string; properties: Record<string, unknown> }): Partial<ICRMDeal> {
    const props = hsDeal.properties;

    return {
      externalId: hsDeal.id,
      provider: CRMProvider.HUBSPOT,
      title: props.dealname ? String(props.dealname) : 'Untitled Deal',
      amount: props.amount ? parseFloat(String(props.amount)) : undefined,
      currency: 'USD',
      stage: props.dealstage ? String(props.dealstage) : DealStage.APPOINTMENT_SCHEDULED,
      probability: props.probability ? parseFloat(String(props.probability)) : undefined,
      closeDate: props.closedate ? new Date(String(props.closedate)) : undefined,
      description: props.description ? String(props.description) : undefined,
      customFields: {},
      metadata: {
        hubspotId: hsDeal.id,
        pipeline: props.pipeline ? String(props.pipeline) : undefined,
        createdAt: hsDeal.id,
        updatedAt: hsDeal.id,
      },
    };
  }

  private transformZohoDeal(data: { id: string; Deal_Name?: string; Amount?: string | number; Stage?: string; Closing_Date?: string; Description?: string; Account_Name?: { name?: string }; Pipeline?: string; Probability?: string | number; Created_Time?: string; Modified_Time?: string }): Partial<ICRMDeal> {
    return {
      externalId: data.id,
      provider: CRMProvider.ZOHO,
      title: data.Deal_Name || 'Untitled Deal',
      amount: data.Amount ? parseFloat(String(data.Amount)) : undefined,
      currency: 'USD',
      stage: data.Stage || DealStage.APPOINTMENT_SCHEDULED,
      probability: data.Probability ? parseFloat(String(data.Probability)) : undefined,
      closeDate: data.Closing_Date ? new Date(data.Closing_Date) : undefined,
      companyName: data.Account_Name?.name,
      description: data.Description,
      customFields: {},
      metadata: {
        zohoId: data.id,
        pipeline: data.Pipeline,
        createdAt: data.Created_Time,
        updatedAt: data.Modified_Time,
      },
    };
  }

  private transformToHubSpot(deal: Partial<ICRMDeal>): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      dealname: deal.title,
    };

    if (deal.amount !== undefined) {
      properties.amount = deal.amount.toString();
    }
    if (deal.stage) {
      properties.dealstage = deal.stage;
    }
    if (deal.probability !== undefined) {
      properties.probability = deal.probability.toString();
    }
    if (deal.closeDate) {
      properties.closedate = new Date(deal.closeDate).getTime().toString();
    }
    if (deal.description) {
      properties.description = deal.description;
    }

    return properties;
  }

  private transformToZoho(deal: Partial<ICRMDeal>): Record<string, unknown> {
    const data: Record<string, unknown> = {
      Deal_Name: deal.title,
    };

    if (deal.amount !== undefined) {
      data.Amount = deal.amount;
    }
    if (deal.stage) {
      data.Stage = deal.stage;
    }
    if (deal.probability !== undefined) {
      data.Probability = deal.probability;
    }
    if (deal.closeDate) {
      data.Closing_Date = new Date(deal.closeDate).toISOString().split('T')[0];
    }
    if (deal.description) {
      data.Description = deal.description;
    }
    if (deal.companyName) {
      data.Account_Name = { name: deal.companyName };
    }

    return data;
  }

  async syncFromProvider(provider: CRMProvider): Promise<SyncDealsResult> {
    const result: SyncDealsResult = {
      success: true,
      synced: 0,
      errors: 0,
      errorDetails: [],
    };

    try {
      await authService.setClientTokens(provider);

      if (provider === CRMProvider.HUBSPOT) {
        await this.syncFromHubSpot(result);
      } else {
        await this.syncFromZoho(result);
      }
    } catch (error) {
      result.success = false;
      result.errorDetails.push({
        externalId: 'SYSTEM',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.errors++;
    }

    return result;
  }

  private async syncFromHubSpot(result: SyncDealsResult): Promise<void> {
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      try {
        const response = await hubspotClient.getDeals(after, 100);

        for (const hsDeal of response.results) {
          try {
            await this.upsertDealFromHubSpot(hsDeal);
            result.synced++;
          } catch (error) {
            result.errors++;
            result.errorDetails.push({
              externalId: hsDeal.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        hasMore = !!response.paging?.next;
        after = response.paging?.next?.after;
      } catch (error) {
        hasMore = false;
        throw error;
      }
    }
  }

  private async syncFromZoho(result: SyncDealsResult): Promise<void> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await zohoClient.getDeals(page, 200);

        if (response.data && response.data.length > 0) {
          for (const zohoDeal of response.data) {
            try {
              await this.upsertDealFromZoho(zohoDeal);
              result.synced++;
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                externalId: zohoDeal.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        hasMore = response.info?.more_records || false;
        page++;
      } catch (error) {
        hasMore = false;
        throw error;
      }
    }
  }

  async upsertDealFromHubSpot(hsDeal: { id: string; properties: Record<string, unknown> }): Promise<ICRMDealDocument> {
    const unifiedDeal = this.transformHubSpotDeal(hsDeal);

    const existing = await CRMDeal.findOne({
      externalId: unifiedDeal.externalId,
      provider: CRMProvider.HUBSPOT,
    });

    if (existing) {
      Object.assign(existing, unifiedDeal);
      return existing.save();
    }

    return CRMDeal.create(unifiedDeal);
  }

  async upsertDealFromZoho(zohoDeal: { id: string; Deal_Name?: string; Amount?: string | number; Stage?: string; Closing_Date?: string; Description?: string; Account_Name?: { name?: string }; Pipeline?: string; Probability?: string | number; Created_Time?: string; Modified_Time?: string }): Promise<ICRMDealDocument> {
    const unifiedDeal = this.transformZohoDeal(zohoDeal);

    const existing = await CRMDeal.findOne({
      externalId: unifiedDeal.externalId,
      provider: CRMProvider.ZOHO,
    });

    if (existing) {
      Object.assign(existing, unifiedDeal);
      return existing.save();
    }

    return CRMDeal.create(unifiedDeal);
  }

  async createInCRM(request: CreateDealRequest, provider: CRMProvider): Promise<{ success: boolean; deal?: ICRMDealDocument; error?: string }> {
    try {
      await authService.setClientTokens(provider);

      const dealData: Partial<ICRMDeal> = {
        provider,
        title: request.title,
        amount: request.amount,
        currency: request.currency || 'USD',
        stage: request.stage || DealStage.APPOINTMENT_SCHEDULED,
        probability: request.probability,
        closeDate: request.closeDate ? new Date(request.closeDate) : undefined,
        companyName: request.companyName,
        description: request.description,
        customFields: {},
        metadata: {},
      };

      if (provider === CRMProvider.HUBSPOT) {
        const hsData = this.transformToHubSpot(dealData);
        const result = await hubspotClient.createDeal(hsData);
        dealData.externalId = result.id;
      } else {
        const zohoData = this.transformToZoho(dealData);
        const result = await zohoClient.createDeal(zohoData);
        if (result.data && result.data[0]?.id) {
          dealData.externalId = result.data[0].id;
        }
      }

      const savedDeal = await CRMDeal.create(dealData);
      return { success: true, deal: savedDeal };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create deal' };
    }
  }

  async getDeals(params: DealQueryParams): Promise<{
    deals: ICRMDealDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      provider,
      stage,
      minAmount,
      maxAmount,
    } = params;

    const query: Record<string, unknown> = {};

    if (provider) {
      query.provider = provider;
    }
    if (stage) {
      query.stage = stage;
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      query.amount = {};
      if (minAmount !== undefined) {
        (query.amount as Record<string, number>).$gte = minAmount;
      }
      if (maxAmount !== undefined) {
        (query.amount as Record<string, number>).$lte = maxAmount;
      }
    }

    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [deals, total] = await Promise.all([
      CRMDeal.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CRMDeal.countDocuments(query),
    ]);

    return {
      deals: deals as unknown as ICRMDealDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDealById(dealId: string): Promise<ICRMDealDocument | null> {
    return CRMDeal.findById(dealId);
  }

  async getDealByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMDealDocument | null> {
    return CRMDeal.findOne({ externalId, provider });
  }

  async updateStage(dealId: string, stage: string): Promise<ICRMDealDocument | null> {
    return CRMDeal.findByIdAndUpdate(
      dealId,
      { stage },
      { new: true }
    );
  }

  async getDealsByContact(contactId: string, provider?: CRMProvider): Promise<ICRMDealDocument[]> {
    return CRMDeal.findByContactId(contactId, provider);
  }

  async getDealStats(provider?: CRMProvider): Promise<{
    totalDeals: number;
    totalValue: number;
    byStage: Record<string, { count: number; value: number }>;
  }> {
    const query: Record<string, unknown> = {};
    if (provider) {
      query.provider = provider;
    }

    const deals = await CRMDeal.find(query).lean();

    const stats = {
      totalDeals: deals.length,
      totalValue: 0,
      byStage: {} as Record<string, { count: number; value: number }>,
    };

    for (const deal of deals) {
      stats.totalValue += deal.amount || 0;

      if (!stats.byStage[deal.stage]) {
        stats.byStage[deal.stage] = { count: 0, value: 0 };
      }
      stats.byStage[deal.stage].count++;
      stats.byStage[deal.stage].value += deal.amount || 0;
    }

    return stats;
  }

  async getPendingDealsCount(provider?: CRMProvider): Promise<number> {
    const query: Record<string, unknown> = {};
    if (provider) {
      query.provider = provider;
    }
    return CRMDeal.countDocuments(query);
  }
}

export const dealService = new DealService();
export default dealService;
