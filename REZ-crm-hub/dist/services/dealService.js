"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealService = exports.DealService = void 0;
const CRMDeal_js_1 = require("../models/CRMDeal.js");
const hubspotClient_js_1 = require("../clients/hubspotClient.js");
const zohoClient_js_1 = require("../clients/zohoClient.js");
const authService_js_1 = require("./authService.js");
const index_js_1 = require("../types/index.js");
class DealService {
    transformHubSpotDeal(hsDeal) {
        const props = hsDeal.properties;
        return {
            externalId: hsDeal.id,
            provider: index_js_1.CRMProvider.HUBSPOT,
            title: props.dealname ? String(props.dealname) : 'Untitled Deal',
            amount: props.amount ? parseFloat(String(props.amount)) : undefined,
            currency: 'USD',
            stage: props.dealstage ? String(props.dealstage) : index_js_1.DealStage.APPOINTMENT_SCHEDULED,
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
    transformZohoDeal(data) {
        return {
            externalId: data.id,
            provider: index_js_1.CRMProvider.ZOHO,
            title: data.Deal_Name || 'Untitled Deal',
            amount: data.Amount ? parseFloat(String(data.Amount)) : undefined,
            currency: 'USD',
            stage: data.Stage || index_js_1.DealStage.APPOINTMENT_SCHEDULED,
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
    transformToHubSpot(deal) {
        const properties = {
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
    transformToZoho(deal) {
        const data = {
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
    async syncFromProvider(provider) {
        const result = {
            success: true,
            synced: 0,
            errors: 0,
            errorDetails: [],
        };
        try {
            await authService_js_1.authService.setClientTokens(provider);
            if (provider === index_js_1.CRMProvider.HUBSPOT) {
                await this.syncFromHubSpot(result);
            }
            else {
                await this.syncFromZoho(result);
            }
        }
        catch (error) {
            result.success = false;
            result.errorDetails.push({
                externalId: 'SYSTEM',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            result.errors++;
        }
        return result;
    }
    async syncFromHubSpot(result) {
        let hasMore = true;
        let after;
        while (hasMore) {
            try {
                const response = await hubspotClient_js_1.hubspotClient.getDeals(after, 100);
                for (const hsDeal of response.results) {
                    try {
                        await this.upsertDealFromHubSpot(hsDeal);
                        result.synced++;
                    }
                    catch (error) {
                        result.errors++;
                        result.errorDetails.push({
                            externalId: hsDeal.id,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
                hasMore = !!response.paging?.next;
                after = response.paging?.next?.after;
            }
            catch (error) {
                hasMore = false;
                throw error;
            }
        }
    }
    async syncFromZoho(result) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            try {
                const response = await zohoClient_js_1.zohoClient.getDeals(page, 200);
                if (response.data && response.data.length > 0) {
                    for (const zohoDeal of response.data) {
                        try {
                            await this.upsertDealFromZoho(zohoDeal);
                            result.synced++;
                        }
                        catch (error) {
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
            }
            catch (error) {
                hasMore = false;
                throw error;
            }
        }
    }
    async upsertDealFromHubSpot(hsDeal) {
        const unifiedDeal = this.transformHubSpotDeal(hsDeal);
        const existing = await CRMDeal_js_1.CRMDeal.findOne({
            externalId: unifiedDeal.externalId,
            provider: index_js_1.CRMProvider.HUBSPOT,
        });
        if (existing) {
            Object.assign(existing, unifiedDeal);
            return existing.save();
        }
        return CRMDeal_js_1.CRMDeal.create(unifiedDeal);
    }
    async upsertDealFromZoho(zohoDeal) {
        const unifiedDeal = this.transformZohoDeal(zohoDeal);
        const existing = await CRMDeal_js_1.CRMDeal.findOne({
            externalId: unifiedDeal.externalId,
            provider: index_js_1.CRMProvider.ZOHO,
        });
        if (existing) {
            Object.assign(existing, unifiedDeal);
            return existing.save();
        }
        return CRMDeal_js_1.CRMDeal.create(unifiedDeal);
    }
    async createInCRM(request, provider) {
        try {
            await authService_js_1.authService.setClientTokens(provider);
            const dealData = {
                provider,
                title: request.title,
                amount: request.amount,
                currency: request.currency || 'USD',
                stage: request.stage || index_js_1.DealStage.APPOINTMENT_SCHEDULED,
                probability: request.probability,
                closeDate: request.closeDate ? new Date(request.closeDate) : undefined,
                companyName: request.companyName,
                description: request.description,
                customFields: {},
                metadata: {},
            };
            if (provider === index_js_1.CRMProvider.HUBSPOT) {
                const hsData = this.transformToHubSpot(dealData);
                const result = await hubspotClient_js_1.hubspotClient.createDeal(hsData);
                dealData.externalId = result.id;
            }
            else {
                const zohoData = this.transformToZoho(dealData);
                const result = await zohoClient_js_1.zohoClient.createDeal(zohoData);
                if (result.data && result.data[0]?.id) {
                    dealData.externalId = result.data[0].id;
                }
            }
            const savedDeal = await CRMDeal_js_1.CRMDeal.create(dealData);
            return { success: true, deal: savedDeal };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to create deal' };
        }
    }
    async getDeals(params) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', provider, stage, minAmount, maxAmount, } = params;
        const query = {};
        if (provider) {
            query.provider = provider;
        }
        if (stage) {
            query.stage = stage;
        }
        if (minAmount !== undefined || maxAmount !== undefined) {
            query.amount = {};
            if (minAmount !== undefined) {
                query.amount.$gte = minAmount;
            }
            if (maxAmount !== undefined) {
                query.amount.$lte = maxAmount;
            }
        }
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [deals, total] = await Promise.all([
            CRMDeal_js_1.CRMDeal.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            CRMDeal_js_1.CRMDeal.countDocuments(query),
        ]);
        return {
            deals: deals,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getDealById(dealId) {
        return CRMDeal_js_1.CRMDeal.findById(dealId);
    }
    async getDealByExternalId(externalId, provider) {
        return CRMDeal_js_1.CRMDeal.findOne({ externalId, provider });
    }
    async updateStage(dealId, stage) {
        return CRMDeal_js_1.CRMDeal.findByIdAndUpdate(dealId, { stage }, { new: true });
    }
    async getDealsByContact(contactId, provider) {
        return CRMDeal_js_1.CRMDeal.findByContactId(contactId, provider);
    }
    async getDealStats(provider) {
        const query = {};
        if (provider) {
            query.provider = provider;
        }
        const deals = await CRMDeal_js_1.CRMDeal.find(query).lean();
        const stats = {
            totalDeals: deals.length,
            totalValue: 0,
            byStage: {},
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
    async getPendingDealsCount(provider) {
        const query = {};
        if (provider) {
            query.provider = provider;
        }
        return CRMDeal_js_1.CRMDeal.countDocuments(query);
    }
}
exports.DealService = DealService;
exports.dealService = new DealService();
exports.default = exports.dealService;
//# sourceMappingURL=dealService.js.map