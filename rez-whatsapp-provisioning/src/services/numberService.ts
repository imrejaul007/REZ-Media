import { getTwilioClient, twilioConfig, webhookConfig, getWebhookUrl } from '../config/twilio.config';
import { logger } from '../utils/logger';
import PhoneNumber from '../models/PhoneNumber';
import MerchantWhatsApp from '../models/MerchantWhatsApp';
import { PhoneNumberType, PhoneNumberStatus } from '../types';
import { provisioningLimits } from '../config/twilio.config';

export interface PhoneNumberProvisionRequest {
  merchantId: string;
  subaccountSid: string;
  countryCode: string;
  type?: PhoneNumberType;
  areaCode?: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  phoneNumber?: string;
  friendlyName?: string;
}

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  lata?: string;
  rateCenter?: string;
  region?: string;
  capabilities: string[];
}

class NumberService {
  private client = getTwilioClient();

  async searchAvailableNumbers(
    countryCode: string,
    options: {
      type?: PhoneNumberType;
      areaCode?: string;
      contains?: string;
      limit?: number;
    } = {}
  ): Promise<AvailableNumber[]> {
    try {
      const params: Record<string, unknown> = {
        countryCode,
        pageSize: options.limit || 20,
      };

      if (options.type === PhoneNumberType.TOLL_FREE) {
        params.type = 'toll_free';
      } else if (options.type === PhoneNumberType.LOCAL || options.areaCode) {
        params.type = 'local';
      }

      if (options.areaCode) {
        params.areaCode = options.areaCode;
      }

      if (options.contains) {
        params.contains = options.contains;
      }

      let availableNumbers;

      if (params.type === 'toll_free') {
        availableNumbers = await this.client.availablePhoneNumbers(countryCode).tollFree.list(params);
      } else {
        availableNumbers = await this.client.availablePhoneNumbers(countryCode).local.list(params);
      }

      const formattedNumbers: AvailableNumber[] = availableNumbers.map((num: any) => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        lata: num.lata,
        rateCenter: num.rateCenter,
        region: num.region,
        capabilities: [
          num.capabilities.voice ? 'voice' : null,
          num.capabilities.sms ? 'sms' : null,
          num.capabilities.MMS ? 'mms' : null,
        ].filter(Boolean) as string[],
      }));

      logger.info('Available phone numbers searched', {
        countryCode,
        count: formattedNumbers.length,
      });

      return formattedNumbers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to search available phone numbers', {
        countryCode,
        error: errorMessage,
      });
      throw new Error(`Failed to search phone numbers: ${errorMessage}`);
    }
  }

  async provisionPhoneNumber(
    request: PhoneNumberProvisionRequest
  ): Promise<{
    phoneNumber: typeof PhoneNumber.prototype;
    twilioSid: string;
  }> {
    try {
      const merchant = await MerchantWhatsApp.findByMerchantId(request.merchantId);

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      if (merchant.status !== 'active') {
        throw new Error('Merchant account is not active');
      }

      const existingCount = await PhoneNumber.countDocuments({
        merchantId: request.merchantId,
        status: { $ne: PhoneNumberStatus.RELEASED },
      });

      if (existingCount >= provisioningLimits.maxPhoneNumbersPerMerchant) {
        throw new Error(
          `Maximum phone number limit (${provisioningLimits.maxPhoneNumbersPerMerchant}) reached`
        );
      }

      const existingByNumber = await PhoneNumber.findByPhoneNumber(request.phoneNumber || '');
      if (existingByNumber) {
        throw new Error('Phone number already provisioned in the system');
      }

      logger.info('Provisioning phone number', {
        merchantId: request.merchantId,
        countryCode: request.countryCode,
      });

      const provisioningParams: Record<string, unknown> = {
        friendlyName: request.friendlyName || `WhatsApp-${request.merchantId}-${Date.now()}`,
        voiceUrl: getWebhookUrl(webhookConfig.outboundPath),
        voiceMethod: 'POST',
        smsUrl: getWebhookUrl(webhookConfig.inboundPath),
        smsMethod: 'POST',
        statusCallback: getWebhookUrl(webhookConfig.statusPath),
        statusCallbackMethod: 'POST',
      };

      let twilioNumber;

      if (request.phoneNumber) {
        twilioNumber = await this.client.incomingPhoneNumbers.create({
          ...provisioningParams,
          phoneNumber: request.phoneNumber,
        });
      } else {
        const searchParams: Record<string, unknown> = {
          countryCode: request.countryCode,
          pageSize: 1,
        };

        if (request.type === PhoneNumberType.TOLL_FREE) {
          searchParams.type = 'toll_free';
        } else {
          searchParams.type = 'local';
          if (request.areaCode) {
            searchParams.areaCode = request.areaCode;
          }
        }

        let availableNumbers;
        if (searchParams.type === 'toll_free') {
          availableNumbers = await this.client.availablePhoneNumbers(request.countryCode)
            .tollFree.list(searchParams);
        } else {
          availableNumbers = await this.client.availablePhoneNumbers(request.countryCode)
            .local.list(searchParams);
        }

        if (!availableNumbers || availableNumbers.length === 0) {
          throw new Error('No available phone numbers found');
        }

        twilioNumber = await this.client.incomingPhoneNumbers.create({
          ...provisioningParams,
          phoneNumberSid: availableNumbers[0].sid,
        });
      }

      const phoneNumberRecord = new PhoneNumber({
        merchantId: request.merchantId,
        subaccountSid: request.subaccountSid,
        twilioSid: twilioNumber.sid,
        phoneNumber: twilioNumber.phoneNumber,
        countryCode: request.countryCode,
        type: request.type || PhoneNumberType.LOCAL,
        status: PhoneNumberStatus.ACTIVE,
        capabilities: {
          voice: request.capabilities?.voice ?? false,
          sms: request.capabilities?.sms ?? true,
          mms: request.capabilities?.mms ?? false,
        },
        twilioDetails: {
          friendlyName: twilioNumber.friendlyName,
          dateCreated: new Date(twilioNumber.dateCreated),
          dateUpdated: new Date(twilioNumber.dateUpdated),
        },
        provisioning: {
          requestedAt: new Date(),
          activatedAt: new Date(),
        },
        metadata: {},
      });

      await phoneNumberRecord.save();

      merchant.provisioning.phoneNumbersProvisioned += 1;
      if (!merchant.provisioning.provisionedAt) {
        merchant.provisioning.provisionedAt = new Date();
      }
      await merchant.save();

      logger.info('Phone number provisioned successfully', {
        merchantId: request.merchantId,
        phoneNumber: twilioNumber.phoneNumber,
        twilioSid: twilioNumber.sid,
      });

      return {
        phoneNumber: phoneNumberRecord,
        twilioSid: twilioNumber.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to provision phone number', {
        merchantId: request.merchantId,
        error: errorMessage,
      });
      throw error;
    }
  }

  async releasePhoneNumber(
    merchantId: string,
    phoneNumberSid: string
  ): Promise<{ success: boolean }> {
    try {
      const phoneNumber = await PhoneNumber.findOne({
        merchantId,
        twilioSid: phoneNumberSid,
      });

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      if (phoneNumber.status === PhoneNumberStatus.RELEASED) {
        throw new Error('Phone number already released');
      }

      await this.client.incomingPhoneNumbers(phoneNumberSid).remove();

      phoneNumber.status = PhoneNumberStatus.RELEASED;
      await phoneNumber.save();

      const merchant = await MerchantWhatsApp.findByMerchantId(merchantId);
      if (merchant) {
        merchant.provisioning.phoneNumbersProvisioned = Math.max(
          0,
          merchant.provisioning.phoneNumbersProvisioned - 1
        );
        await merchant.save();
      }

      logger.info('Phone number released', {
        merchantId,
        phoneNumberSid,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to release phone number', {
        merchantId,
        phoneNumberSid,
        error: errorMessage,
      });
      throw error;
    }
  }

  async getPhoneNumber(phoneNumberSid: string): Promise<any> {
    try {
      const twilioNumber = await this.client.incomingPhoneNumbers(phoneNumberSid).fetch();
      return twilioNumber;
    } catch (error) {
      if ((error as any)?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async updatePhoneNumber(
    merchantId: string,
    phoneNumberSid: string,
    updates: {
      friendlyName?: string;
      voiceUrl?: string;
      smsUrl?: string;
    }
  ): Promise<any> {
    try {
      const phoneNumber = await PhoneNumber.findOne({
        merchantId,
        twilioSid: phoneNumberSid,
      });

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      const twilioNumber = await this.client.incomingPhoneNumbers(phoneNumberSid).update({
        friendlyName: updates.friendlyName,
        voiceUrl: updates.voiceUrl,
        smsUrl: updates.smsUrl,
      });

      phoneNumber.twilioDetails.friendlyName = twilioNumber.friendlyName;
      phoneNumber.twilioDetails.dateUpdated = new Date();
      await phoneNumber.save();

      logger.info('Phone number updated', {
        merchantId,
        phoneNumberSid,
      });

      return twilioNumber;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update phone number', {
        merchantId,
        phoneNumberSid,
        error: errorMessage,
      });
      throw error;
    }
  }

  async listMerchantPhoneNumbers(
    merchantId: string,
    options: {
      status?: PhoneNumberStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    phoneNumbers: typeof PhoneNumber[];
    total: number;
  }> {
    try {
      const query: Record<string, unknown> = { merchantId };

      if (options.status) {
        query.status = options.status;
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const [phoneNumbers, total] = await Promise.all([
        PhoneNumber.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        PhoneNumber.countDocuments(query),
      ]);

      return { phoneNumbers, total };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list merchant phone numbers', {
        merchantId,
        error: errorMessage,
      });
      throw error;
    }
  }

  async addToSandbox(phoneNumberSid: string): Promise<{ success: boolean }> {
    try {
      const phoneNumber = await PhoneNumber.findOne({ twilioSid: phoneNumberSid });

      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      const result = await this.client.conversations.v1.conversations(
        'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
      ).participants.create({
        messagingBinding: {
          type: 'sandbox',
          address: phoneNumber.phoneNumber,
        },
      });

      phoneNumber.sandboxConfig = {
        enabled: true,
        addedAt: new Date(),
      };
      await phoneNumber.save();

      logger.info('Phone number added to sandbox', {
        phoneNumberSid,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add phone number to sandbox', {
        phoneNumberSid,
        error: errorMessage,
      });
      throw error;
    }
  }
}

export const numberService = new NumberService();
export default numberService;
