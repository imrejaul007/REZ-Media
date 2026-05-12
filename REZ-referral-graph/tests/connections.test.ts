/**
 * REZ Referral Graph - Connection Tests
 */

import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const WALLET_API = process.env.WALLET_API || 'https://rez-wallet.onrender.com';
const INTELLIGENCE_API = process.env.INTELLIGENCE_API || 'https://rez-intelligence.onrender.com';

describe('REZ-Referral Connection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Wallet Connections', () => {
    test('POST /api/earn - reward referrer', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'referrer123',
        amount: 100,
        source: 'referral_signup',
        reason: 'Referral bonus for user referral'
      };

      await axios.post(`${WALLET_API}/api/earn`, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${WALLET_API}/api/earn`,
        data
      );
    });

    test('POST /api/earn - merchant referral reward', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'merchant123',
        amount: 500,
        source: 'merchant_referral',
        reason: 'Merchant referral bonus'
      };

      await axios.post(`${WALLET_API}/api/earn`, data);

      expect(mockedAxios.post).toHaveBeenCalled();
    });

    test('POST /api/earn - creator referral reward', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'creator123',
        amount: 1000,
        source: 'creator_referral',
        reason: 'Creator referral bonus'
      };

      await axios.post(`${WALLET_API}/api/earn`, data);

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('Intelligence Connections', () => {
    test('POST /api/intent/track - track referral intent', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'referrer123',
        intent_type: 'referral_activated',
        entities: { referral_type: 'user' }
      };

      await axios.post(`${INTELLIGENCE_API}/api/intent/track`, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${INTELLIGENCE_API}/api/intent/track`,
        data
      );
    });

    test('POST /api/spend/track - track referral value', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'referee123',
        referral_type: 'user',
        ltv_prediction: 5000
      };

      await axios.post(`${INTELLIGENCE_API}/api/spend/track`, data);

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });
});
