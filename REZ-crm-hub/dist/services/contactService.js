"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactService = exports.ContactService = void 0;
const CRMContact_js_1 = require("../models/CRMContact.js");
const hubspotClient_js_1 = require("../clients/hubspotClient.js");
const zohoClient_js_1 = require("../clients/zohoClient.js");
const authService_js_1 = require("./authService.js");
const index_js_1 = require("../types/index.js");
class ContactService {
    transformHubSpotContact(hsContact) {
        const props = hsContact.properties;
        const phones = [];
        if (props.phone) {
            phones.push({ number: String(props.phone), type: 'work', isPrimary: true });
        }
        if (props.mobilephone) {
            phones.push({ number: String(props.mobilephone), type: 'mobile', isPrimary: false });
        }
        const emails = [];
        if (props.email) {
            emails.push({ address: String(props.email), isPrimary: true });
        }
        const address = props.address ? {
            street: String(props.address),
            city: props.city ? String(props.city) : undefined,
            state: props.state ? String(props.state) : undefined,
            postalCode: props.zip ? String(props.zip) : undefined,
            country: props.country ? String(props.country) : undefined,
        } : undefined;
        return {
            externalId: hsContact.id,
            provider: index_js_1.CRMProvider.HUBSPOT,
            email: props.email ? String(props.email) : undefined,
            firstName: props.firstname ? String(props.firstname) : 'Unknown',
            lastName: props.lastname ? String(props.lastname) : 'Unknown',
            phones,
            emails,
            company: props.company ? String(props.company) : undefined,
            jobTitle: props.jobtitle ? String(props.jobtitle) : undefined,
            address,
            tags: [],
            lifecycleStage: props.lifecyclestage ? String(props.lifecyclestage) : undefined,
            leadSource: props.hs_lead_status ? String(props.hs_lead_status) : undefined,
            customFields: {},
            syncStatus: index_js_1.ContactSyncStatus.SYNCED,
            lastSyncedAt: new Date(),
            metadata: {
                hubspotId: hsContact.id,
                createdAt: hsContact.id,
                updatedAt: hsContact.id,
            },
        };
    }
    transformZohoContact(data) {
        const phones = [];
        if (data.Phone) {
            phones.push({ number: data.Phone, type: 'work', isPrimary: true });
        }
        if (data.Mobile) {
            phones.push({ number: data.Mobile, type: 'mobile', isPrimary: false });
        }
        const emails = [];
        if (data.Email) {
            emails.push({ address: data.Email, isPrimary: true });
        }
        const address = data.Mailing_Street ? {
            street: data.Mailing_Street,
            city: data.Mailing_City,
            state: data.Mailing_State,
            postalCode: data.Mailing_Zip,
            country: data.Mailing_Country,
        } : undefined;
        const nameParts = (data.Full_Name || data.Display_Name || '').split(' ');
        const firstName = data.First_Name || nameParts[0] || 'Unknown';
        const lastName = data.Last_Name || nameParts.slice(1).join(' ') || 'Unknown';
        return {
            externalId: data.id,
            provider: index_js_1.CRMProvider.ZOHO,
            email: data.Email,
            firstName,
            lastName,
            phones,
            emails,
            company: data.Account_Name?.name,
            jobTitle: data.Designation,
            address,
            tags: [],
            customFields: {},
            syncStatus: index_js_1.ContactSyncStatus.SYNCED,
            lastSyncedAt: new Date(),
            metadata: {
                zohoId: data.id,
                createdAt: data.Created_Time,
                updatedAt: data.Modified_Time,
            },
        };
    }
    transformToHubSpot(contact) {
        const properties = {
            firstname: contact.firstName,
            lastname: contact.lastName,
        };
        if (contact.email) {
            properties.email = contact.email;
        }
        if (contact.phones && contact.phones.length > 0) {
            const primaryPhone = contact.phones.find(p => p.isPrimary) || contact.phones[0];
            if (primaryPhone) {
                properties.phone = primaryPhone.number;
            }
        }
        if (contact.company) {
            properties.company = contact.company;
        }
        if (contact.jobTitle) {
            properties.jobtitle = contact.jobTitle;
        }
        if (contact.address?.street) {
            properties.address = contact.address.street;
        }
        if (contact.address?.city) {
            properties.city = contact.address.city;
        }
        if (contact.address?.state) {
            properties.state = contact.address.state;
        }
        if (contact.address?.postalCode) {
            properties.zip = contact.address.postalCode;
        }
        if (contact.address?.country) {
            properties.country = contact.address.country;
        }
        return properties;
    }
    transformToZoho(contact) {
        const data = {
            First_Name: contact.firstName,
            Last_Name: contact.lastName,
        };
        if (contact.email) {
            data.Email = contact.email;
        }
        if (contact.phones && contact.phones.length > 0) {
            const primaryPhone = contact.phones.find(p => p.isPrimary) || contact.phones[0];
            if (primaryPhone) {
                data.Phone = primaryPhone.number;
            }
        }
        if (contact.company) {
            data.Account_Name = { name: contact.company };
        }
        if (contact.jobTitle) {
            data.Designation = contact.jobTitle;
        }
        if (contact.address?.street) {
            data.Mailing_Street = contact.address.street;
        }
        if (contact.address?.city) {
            data.Mailing_City = contact.address.city;
        }
        if (contact.address?.state) {
            data.Mailing_State = contact.address.state;
        }
        if (contact.address?.postalCode) {
            data.Mailing_Zip = contact.address.postalCode;
        }
        if (contact.address?.country) {
            data.Mailing_Country = contact.address.country;
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
                const response = await hubspotClient_js_1.hubspotClient.getContacts(after, 100);
                for (const hsContact of response.results) {
                    try {
                        await this.upsertContactFromHubSpot(hsContact);
                        result.synced++;
                    }
                    catch (error) {
                        result.errors++;
                        result.errorDetails.push({
                            externalId: hsContact.id,
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
                const response = await zohoClient_js_1.zohoClient.getContacts(page, 200);
                if (response.data && response.data.length > 0) {
                    for (const zohoContact of response.data) {
                        try {
                            await this.upsertContactFromZoho(zohoContact);
                            result.synced++;
                        }
                        catch (error) {
                            result.errors++;
                            result.errorDetails.push({
                                externalId: zohoContact.id,
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
    async upsertContactFromHubSpot(hsContact) {
        const unifiedContact = this.transformHubSpotContact(hsContact);
        const existing = await CRMContact_js_1.CRMContact.findOne({
            externalId: unifiedContact.externalId,
            provider: index_js_1.CRMProvider.HUBSPOT,
        });
        if (existing) {
            Object.assign(existing, unifiedContact);
            existing.syncStatus = index_js_1.ContactSyncStatus.SYNCED;
            existing.lastSyncedAt = new Date();
            existing.syncError = undefined;
            return existing.save();
        }
        return CRMContact_js_1.CRMContact.create(unifiedContact);
    }
    async upsertContactFromZoho(zohoContact) {
        const unifiedContact = this.transformZohoContact(zohoContact);
        const existing = await CRMContact_js_1.CRMContact.findOne({
            externalId: unifiedContact.externalId,
            provider: index_js_1.CRMProvider.ZOHO,
        });
        if (existing) {
            Object.assign(existing, unifiedContact);
            existing.syncStatus = index_js_1.ContactSyncStatus.SYNCED;
            existing.lastSyncedAt = new Date();
            existing.syncError = undefined;
            return existing.save();
        }
        return CRMContact_js_1.CRMContact.create(unifiedContact);
    }
    async exportToCRM(contactId, provider) {
        const contact = await CRMContact_js_1.CRMContact.findById(contactId);
        if (!contact) {
            return { success: false, error: 'Contact not found' };
        }
        const contactObj = contact.toObject();
        try {
            await authService_js_1.authService.setClientTokens(provider);
            if (provider === index_js_1.CRMProvider.HUBSPOT) {
                const hsData = this.transformToHubSpot(contactObj);
                const result = await hubspotClient_js_1.hubspotClient.upsertContact(hsData);
                contact.externalId = result.id;
            }
            else {
                const zohoData = this.transformToZoho(contactObj);
                const result = await zohoClient_js_1.zohoClient.upsertContact(zohoData);
                if (result.data && result.data[0]?.id) {
                    contact.externalId = result.data[0].id;
                }
            }
            contact.syncStatus = index_js_1.ContactSyncStatus.SYNCED;
            contact.lastSyncedAt = new Date();
            await contact.save();
            return { success: true, externalId: contact.externalId };
        }
        catch (error) {
            contact.syncStatus = index_js_1.ContactSyncStatus.ERROR;
            contact.syncError = error instanceof Error ? error.message : 'Export failed';
            await contact.save();
            return { success: false, error: contact.syncError };
        }
    }
    async getContacts(params) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', provider, syncStatus, search, linkedRezUserId, } = params;
        const query = {};
        if (provider) {
            query.provider = provider;
        }
        if (syncStatus) {
            query.syncStatus = syncStatus;
        }
        if (linkedRezUserId) {
            query.linkedRezUserId = linkedRezUserId;
        }
        if (search) {
            query.$text = { $search: search };
        }
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const [contacts, total] = await Promise.all([
            CRMContact_js_1.CRMContact.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            CRMContact_js_1.CRMContact.countDocuments(query),
        ]);
        return {
            contacts: contacts,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getContactById(contactId) {
        return CRMContact_js_1.CRMContact.findById(contactId);
    }
    async getContactByExternalId(externalId, provider) {
        return CRMContact_js_1.CRMContact.findOne({ externalId, provider });
    }
    async forceSyncContact(contactId, provider) {
        const contact = await CRMContact_js_1.CRMContact.findById(contactId);
        if (!contact) {
            return { success: false, error: 'Contact not found' };
        }
        return this.exportToCRM(contactId, provider);
    }
    async linkToRezUser(contactId, rezUserId) {
        return CRMContact_js_1.CRMContact.findByIdAndUpdate(contactId, { linkedRezUserId: rezUserId }, { new: true });
    }
    async unlinkFromRezUser(contactId) {
        return CRMContact_js_1.CRMContact.findByIdAndUpdate(contactId, { $unset: { linkedRezUserId: 1 } }, { new: true });
    }
    async getPendingContactsCount(provider) {
        const query = {
            syncStatus: index_js_1.ContactSyncStatus.PENDING,
        };
        if (provider) {
            query.provider = provider;
        }
        return CRMContact_js_1.CRMContact.countDocuments(query);
    }
    async markAsPending(contactIds) {
        await CRMContact_js_1.CRMContact.updateMany({ _id: { $in: contactIds } }, { syncStatus: index_js_1.ContactSyncStatus.PENDING });
    }
}
exports.ContactService = ContactService;
exports.contactService = new ContactService();
exports.default = exports.contactService;
//# sourceMappingURL=contactService.js.map