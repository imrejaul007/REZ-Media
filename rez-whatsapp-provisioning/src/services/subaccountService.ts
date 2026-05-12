import { getTwilioClient, twilioConfig } from '../config/twilio.config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface SubaccountCredentials {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
}

export interface SubaccountDetails {
  sid: string;
  friendlyName: string;
  status: string;
  dateCreated: Date;
  dateUpdated: Date;
}

class SubaccountService {
  private client = getTwilioClient();

  async createSubaccount(
    merchantId: string,
    friendlyName: string,
    email?: string
  ): Promise<SubaccountDetails & SubaccountCredentials> {
    try {
      logger.info('Creating subaccount for merchant', {
        merchantId,
        friendlyName,
      });

      const subaccount = await this.client.api.accounts.create({
        friendlyName: `${friendlyName}-${merchantId}`,
        status: 'active',
      });

      const apiKey = await this.client.newKeys.create({
        friendlyName: `API-Key-${subaccount.sid}`,
      });

      logger.info('Subaccount created successfully', {
        merchantId,
        subaccountSid: subaccount.sid,
        apiKeySid: apiKey.sid,
      });

      return {
        sid: subaccount.sid,
        friendlyName: subaccount.friendlyName,
        status: subaccount.status,
        dateCreated: new Date(subaccount.dateCreated),
        dateUpdated: new Date(subaccount.dateUpdated),
        accountSid: subaccount.sid,
        apiKeySid: apiKey.sid,
        apiKeySecret: apiKey.secret,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create subaccount', {
        merchantId,
        error: errorMessage,
      });
      throw new Error(`Failed to create subaccount: ${errorMessage}`);
    }
  }

  async getSubaccount(subaccountSid: string): Promise<SubaccountDetails | null> {
    try {
      const subaccount = await this.client.api.accounts(subaccountSid).fetch();

      return {
        sid: subaccount.sid,
        friendlyName: subaccount.friendlyName,
        status: subaccount.status,
        dateCreated: new Date(subaccount.dateCreated),
        dateUpdated: new Date(subaccount.dateUpdated),
      };
    } catch (error) {
      if ((error as any)?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateSubaccount(
    subaccountSid: string,
    updates: {
      friendlyName?: string;
      status?: 'active' | 'suspended';
    }
  ): Promise<SubaccountDetails> {
    try {
      const subaccount = await this.client.api.accounts(subaccountSid).update({
        friendlyName: updates.friendlyName,
        status: updates.status,
      });

      logger.info('Subaccount updated', {
        subaccountSid,
        updates,
      });

      return {
        sid: subaccount.sid,
        friendlyName: subaccount.friendlyName,
        status: subaccount.status,
        dateCreated: new Date(subaccount.dateCreated),
        dateUpdated: new Date(subaccount.dateUpdated),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update subaccount', {
        subaccountSid,
        error: errorMessage,
      });
      throw new Error(`Failed to update subaccount: ${errorMessage}`);
    }
  }

  async suspendSubaccount(subaccountSid: string): Promise<SubaccountDetails> {
    return this.updateSubaccount(subaccountSid, { status: 'suspended' });
  }

  async activateSubaccount(subaccountSid: string): Promise<SubaccountDetails> {
    return this.updateSubaccount(subaccountSid, { status: 'active' });
  }

  async closeSubaccount(subaccountSid: string): Promise<SubaccountDetails> {
    try {
      const subaccount = await this.client.api.accounts(subaccountSid).update({
        status: 'closed',
      });

      logger.info('Subaccount closed', { subaccountSid });

      return {
        sid: subaccount.sid,
        friendlyName: subaccount.friendlyName,
        status: subaccount.status,
        dateCreated: new Date(subaccount.dateCreated),
        dateUpdated: new Date(subaccount.dateUpdated),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to close subaccount', {
        subaccountSid,
        error: errorMessage,
      });
      throw new Error(`Failed to close subaccount: ${errorMessage}`);
    }
  }

  async listSubaccounts(
    options: {
      pageSize?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    subaccounts: SubaccountDetails[];
    nextPageToken?: string;
    total?: number;
  }> {
    try {
      const page = await this.client.api.accounts.list({
        pageSize: options.pageSize || 50,
        pageToken: options.pageToken,
      });

      const subaccounts: SubaccountDetails[] = page.map(account => ({
        sid: account.sid,
        friendlyName: account.friendlyName,
        status: account.status,
        dateCreated: new Date(account.dateCreated),
        dateUpdated: new Date(account.dateUpdated),
      }));

      return {
        subaccounts,
        nextPageToken: page.nextPageUri ? this.extractPageToken(page.nextPageUri) : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list subaccounts', { error: errorMessage });
      throw new Error(`Failed to list subaccounts: ${errorMessage}`);
    }
  }

  async regenerateApiKey(subaccountSid: string): Promise<SubaccountCredentials> {
    try {
      const apiKey = await this.client.newKeys.create({
        friendlyName: `API-Key-${subaccountSid}-${Date.now()}`,
      });

      logger.info('API key regenerated', {
        subaccountSid,
        apiKeySid: apiKey.sid,
      });

      return {
        accountSid: subaccountSid,
        apiKeySid: apiKey.sid,
        apiKeySecret: apiKey.secret,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to regenerate API key', {
        subaccountSid,
        error: errorMessage,
      });
      throw new Error(`Failed to regenerate API key: ${errorMessage}`);
    }
  }

  async createCredentialsForSubaccount(
    subaccountSid: string
  ): Promise<{ apiKeySid: string; apiKeySecret: string }> {
    try {
      const mainAccountSid = twilioConfig.accountSid;

      const subaccountClient = require('twilio')(
        subaccountSid,
        twilioConfig.authToken
      );

      const apiKey = await subaccountClient.newKeys.create({
        friendlyName: `Merchant-Key-${subaccountSid}`,
      });

      logger.info('Credentials created for subaccount', {
        subaccountSid,
        apiKeySid: apiKey.sid,
      });

      return {
        apiKeySid: apiKey.sid,
        apiKeySecret: apiKey.secret,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create credentials for subaccount', {
        subaccountSid,
        error: errorMessage,
      });
      throw new Error(`Failed to create credentials: ${errorMessage}`);
    }
  }

  async getSubaccountUsage(
    subaccountSid: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalUsage: number;
    byCategory: Record<string, number>;
  }> {
    try {
      const subaccountClient = require('twilio')(
        subaccountSid,
        twilioConfig.authToken
      );

      const records = await subaccountClient.usage.records.list({
        startDate,
        endDate,
      });

      const byCategory: Record<string, number> = {};
      let totalUsage = 0;

      for (const record of records) {
        const category = record.usageCategory;
        const usage = parseFloat(String(record.usage)) || 0;
        byCategory[category] = (byCategory[category] || 0) + usage;
        totalUsage += parseFloat(String(record.price)) || 0;
      }

      return { totalUsage, byCategory };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get subaccount usage', {
        subaccountSid,
        error: errorMessage,
      });
      throw new Error(`Failed to get subaccount usage: ${errorMessage}`);
    }
  }

  private extractPageToken(uri: string): string {
    try {
      const url = new URL(`https://api.twilio.com${uri}`);
      return url.searchParams.get('PageToken') || '';
    } catch {
      return '';
    }
  }

  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const subaccountService = new SubaccountService();
export default subaccountService;
