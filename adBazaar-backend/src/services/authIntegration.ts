/**
 * AdBazaar - Auth Integration
 * Integrates with RABTUL auth service
 */

import axios from 'axios';

// Configuration
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3000';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  userType: 'owner' | 'advertiser' | 'admin';
  verified: boolean;
}

interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
}

class AuthClient {
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = AUTH_URL;
    this.token = INTERNAL_TOKEN;
  }

  /**
   * Verify internal token
   */
  async verifyInternal(token: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/verify-internal`,
        { token },
        { timeout: 5000 }
      );
      return response.data.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/users/${userId}`,
        {
          headers: { 'X-Internal-Token': this.token },
          timeout: 5000,
        }
      );
      return response.data.user;
    } catch {
      return null;
    }
  }

  /**
   * Verify KYC
   */
  async verifyKYC(userId: string, kycData: {
    documentType: string;
    documentNumber: string;
  }): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/kyc/verify`,
        { userId, ...kycData },
        {
          headers: { 'X-Internal-Token': this.token },
          timeout: 10000,
        }
      );
      return response.data.verified === true;
    } catch {
      return false;
    }
  }

  /**
   * Login user (generate token)
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/login`,
        { email, password },
        { timeout: 10000 }
      );
      return {
        success: true,
        user: response.data.user,
        token: response.data.token,
      };
    } catch {
      return { success: false };
    }
  }

  /**
   * Register user
   */
  async register(data: {
    email: string;
    phone: string;
    password: string;
    name: string;
    userType: 'owner' | 'advertiser';
  }): Promise<AuthResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/register`,
        data,
        { timeout: 10000 }
      );
      return {
        success: true,
        user: response.data.user,
        token: response.data.token,
      };
    } catch {
      return { success: false };
    }
  }
}

export const authClient = new AuthClient();
export default authClient;
