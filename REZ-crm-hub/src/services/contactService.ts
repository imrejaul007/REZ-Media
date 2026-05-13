import { CRMContact, ICRMContactDocument } from '../models/CRMContact.js';
import { hubspotClient } from '../clients/hubspotClient.js';
import { zohoClient } from '../clients/zohoClient.js';
import { authService } from './authService.js';
import {
  CRMProvider,
  ContactSyncStatus,
  ContactQueryParams,
  CRMContact as ICRMContact,
  Phone,
  Email,
  Address,
} from '../types/index.js';

export interface SyncContactsResult {
  success: boolean;
  synced: number;
  errors: number;
  errorDetails: Array<{ externalId: string; error: string }>;
}

export class ContactService {
  private transformHubSpotContact(hsContact: { id: string; properties: Record<string, unknown> }): Partial<ICRMContact> {
    const props = hsContact.properties;

    const phones: Phone[] = [];
    if (props.phone) {
      phones.push({ number: String(props.phone), type: 'work', isPrimary: true as boolean });
    }
    if (props.mobilephone) {
      phones.push({ number: String(props.mobilephone), type: 'mobile', isPrimary: false as boolean });
    }

    const emails: Email[] = [];
    if (props.email) {
      emails.push({ address: String(props.email), isPrimary: true as boolean });
    }

    const address: Address | undefined = props.address ? {
      street: String(props.address),
      city: props.city ? String(props.city) : undefined,
      state: props.state ? String(props.state) : undefined,
      postalCode: props.zip ? String(props.zip) : undefined,
      country: props.country ? String(props.country) : undefined,
    } : undefined;

    return {
      externalId: hsContact.id,
      provider: CRMProvider.HUBSPOT,
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
      syncStatus: ContactSyncStatus.SYNCED,
      lastSyncedAt: new Date(),
      metadata: {
        hubspotId: hsContact.id,
        createdAt: hsContact.id,
        updatedAt: hsContact.id,
      },
    };
  }

  private transformZohoContact(data: { id: string; Email?: string; Phone?: string; Mobile?: string; First_Name?: string; Last_Name?: string; Full_Name?: string; Display_Name?: string; Account_Name?: { name?: string }; Designation?: string; Mailing_Street?: string; Mailing_City?: string; Mailing_State?: string; Mailing_Zip?: string; Mailing_Country?: string; Created_Time?: string; Modified_Time?: string }): Partial<ICRMContact> {
    const phones: Phone[] = [];
    if (data.Phone) {
      phones.push({ number: data.Phone, type: 'work', isPrimary: true as boolean });
    }
    if (data.Mobile) {
      phones.push({ number: data.Mobile, type: 'mobile', isPrimary: false as boolean });
    }

    const emails: Email[] = [];
    if (data.Email) {
      emails.push({ address: data.Email, isPrimary: true as boolean });
    }

    const address: Address | undefined = data.Mailing_Street ? {
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
      provider: CRMProvider.ZOHO,
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
      syncStatus: ContactSyncStatus.SYNCED,
      lastSyncedAt: new Date(),
      metadata: {
        zohoId: data.id,
        createdAt: data.Created_Time,
        updatedAt: data.Modified_Time,
      },
    };
  }

  private transformToHubSpot(contact: Partial<ICRMContact>): Record<string, unknown> {
    const properties: Record<string, unknown> = {
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

  private transformToZoho(contact: Partial<ICRMContact>): Record<string, unknown> {
    const data: Record<string, unknown> = {
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

  async syncFromProvider(provider: CRMProvider): Promise<SyncContactsResult> {
    const result: SyncContactsResult = {
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

  private async syncFromHubSpot(result: SyncContactsResult): Promise<void> {
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      try {
        const response = await hubspotClient.getContacts(after, 100);

        for (const hsContact of response.results) {
          try {
            await this.upsertContactFromHubSpot(hsContact);
            result.synced++;
          } catch (error) {
            result.errors++;
            result.errorDetails.push({
              externalId: hsContact.id,
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

  private async syncFromZoho(result: SyncContactsResult): Promise<void> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await zohoClient.getContacts(page, 200);

        if (response.data && response.data.length > 0) {
          for (const zohoContact of response.data) {
            try {
              await this.upsertContactFromZoho(zohoContact);
              result.synced++;
            } catch (error) {
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
      } catch (error) {
        hasMore = false;
        throw error;
      }
    }
  }

  async upsertContactFromHubSpot(hsContact: { id: string; properties: Record<string, unknown> }): Promise<ICRMContactDocument> {
    const unifiedContact = this.transformHubSpotContact(hsContact);

    const existing = await CRMContact.findOne({
      externalId: unifiedContact.externalId,
      provider: CRMProvider.HUBSPOT,
    });

    if (existing) {
      Object.assign(existing, unifiedContact);
      existing.syncStatus = ContactSyncStatus.SYNCED;
      existing.lastSyncedAt = new Date();
      existing.syncError = undefined;
      return existing.save();
    }

    return CRMContact.create(unifiedContact);
  }

  async upsertContactFromZoho(zohoContact: { id: string; Email?: string; Phone?: string; Mobile?: string; First_Name?: string; Last_Name?: string; Full_Name?: string; Display_Name?: string; Account_Name?: { name?: string }; Designation?: string; Mailing_Street?: string; Mailing_City?: string; Mailing_State?: string; Mailing_Zip?: string; Mailing_Country?: string; Created_Time?: string; Modified_Time?: string }): Promise<ICRMContactDocument> {
    const unifiedContact = this.transformZohoContact(zohoContact);

    const existing = await CRMContact.findOne({
      externalId: unifiedContact.externalId,
      provider: CRMProvider.ZOHO,
    });

    if (existing) {
      Object.assign(existing, unifiedContact);
      existing.syncStatus = ContactSyncStatus.SYNCED;
      existing.lastSyncedAt = new Date();
      existing.syncError = undefined;
      return existing.save();
    }

    return CRMContact.create(unifiedContact);
  }

  async exportToCRM(contactId: string, provider: CRMProvider): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const contact = await CRMContact.findById(contactId);
    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    const contactObj = contact.toObject() as unknown as Partial<ICRMContact>;

    try {
      await authService.setClientTokens(provider);

      if (provider === CRMProvider.HUBSPOT) {
        const hsData = this.transformToHubSpot(contactObj);
        const result = await hubspotClient.upsertContact(hsData);
        contact.externalId = result.id;
      } else {
        const zohoData = this.transformToZoho(contactObj);
        const result = await zohoClient.upsertContact(zohoData);
        if (result.data && result.data[0]?.id) {
          contact.externalId = result.data[0].id;
        }
      }

      contact.syncStatus = ContactSyncStatus.SYNCED;
      contact.lastSyncedAt = new Date();
      await contact.save();

      return { success: true, externalId: contact.externalId };
    } catch (error) {
      contact.syncStatus = ContactSyncStatus.ERROR;
      contact.syncError = error instanceof Error ? error.message : 'Export failed';
      await contact.save();

      return { success: false, error: contact.syncError };
    }
  }

  async getContacts(params: ContactQueryParams): Promise<{
    contacts: ICRMContactDocument[];
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
      syncStatus,
      search,
      linkedRezUserId,
    } = params;

    const query: Record<string, unknown> = {};

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

    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [contacts, total] = await Promise.all([
      CRMContact.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CRMContact.countDocuments(query),
    ]);

    return {
      contacts: contacts as unknown as ICRMContactDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getContactById(contactId: string): Promise<ICRMContactDocument | null> {
    return CRMContact.findById(contactId);
  }

  async getContactByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMContactDocument | null> {
    return CRMContact.findOne({ externalId, provider });
  }

  async forceSyncContact(contactId: string, provider: CRMProvider): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const contact = await CRMContact.findById(contactId);
    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    return this.exportToCRM(contactId, provider);
  }

  async linkToRezUser(contactId: string, rezUserId: string): Promise<ICRMContactDocument | null> {
    return CRMContact.findByIdAndUpdate(
      contactId,
      { linkedRezUserId: rezUserId },
      { new: true }
    );
  }

  async unlinkFromRezUser(contactId: string): Promise<ICRMContactDocument | null> {
    return CRMContact.findByIdAndUpdate(
      contactId,
      { $unset: { linkedRezUserId: 1 } },
      { new: true }
    );
  }

  async getPendingContactsCount(provider?: CRMProvider): Promise<number> {
    const query: Record<string, unknown> = {
      syncStatus: ContactSyncStatus.PENDING,
    };
    if (provider) {
      query.provider = provider;
    }
    return CRMContact.countDocuments(query);
  }

  async markAsPending(contactIds: string[]): Promise<void> {
    await CRMContact.updateMany(
      { _id: { $in: contactIds } },
      { syncStatus: ContactSyncStatus.PENDING }
    );
  }
}

export const contactService = new ContactService();
export default contactService;
