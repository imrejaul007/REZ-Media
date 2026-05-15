/**
 * API Client for Karma Mobile App
 * Points to the Karma Service at https://rez-karma-service.onrender.com/v1/karma/*
 * Includes offline support and request caching
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCache, setCache, queueRequest, removeFromQueue, getOfflineQueue } from './cache';

const BASE_URL = 'https://rez-karma-service.onrender.com/v1/karma';
const TOKEN_KEY = 'rez_karma_token';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: Record<string, string | number>, useCache = true): Promise<ApiResponse<T>> {
    // Try cache first for GET requests
    if (useCache) {
      const cacheKey = `${url}:${JSON.stringify(params || {})}`;
      const cached = await getCache<T>(cacheKey);
      if (cached) {
        console.log('[API] Cache hit:', url);
        return { success: true, data: cached };
      }
    }

    try {
      const response = await this.client.get<ApiResponse<T>>(url, { params });

      // Cache successful GET requests
      if (useCache && response.data.success && response.data.data) {
        await setCache(`${url}:${JSON.stringify(params || {})}`, response.data.data, CACHE_TTL);
      }

      return response.data;
    } catch (error: any) {
      // On network error, try cache as fallback
      if (!error.response && useCache) {
        const cacheKey = `${url}:${JSON.stringify(params || {})}`;
        const cached = await getCache<T>(cacheKey);
        if (cached) {
          console.log('[API] Network error, using cache:', url);
          return { success: true, data: cached, message: 'Cached data (offline)' };
        }
      }

      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async post<T, D = unknown>(url: string, data?: D): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error: any) {
      // Queue request for offline retry
      if (!error.response) {
        await queueRequest(url, 'POST', data);
        console.log('[API] Request queued for offline:', url);
        return {
          success: false,
          message: 'Request queued for when you are back online',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async put<T, D = unknown>(url: string, data?: D): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error: any) {
      if (!error.response) {
        await queueRequest(url, 'PUT', data);
        return {
          success: false,
          message: 'Request queued for when you are back online',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async patch<T, D = unknown>(url: string, data?: D): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error: any) {
      if (!error.response) {
        await queueRequest(url, 'PATCH', data);
        return {
          success: false,
          message: 'Request queued for when you are back online',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url);
      return response.data;
    } catch (error: any) {
      if (!error.response) {
        await queueRequest(url, 'DELETE');
        return {
          success: false,
          message: 'Request queued for when you are back online',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  /**
   * Retry queued offline requests when back online
   */
  async retryOfflineRequests(): Promise<void> {
    const queue = await getOfflineQueue();
    console.log('[API] Retrying offline requests:', queue.length);

    for (const request of queue) {
      try {
        const config: AxiosRequestConfig = {};
        if (request.data) config.data = request.data;

        await this.client.request({
          url: request.url,
          method: request.method,
          ...config,
        });

        await removeFromQueue(request.id);
        console.log('[API] Offline request succeeded:', request.url);
      } catch (error) {
        console.log('[API] Offline request failed, keeping in queue:', request.url);
      }
    }
  }
}

const apiClient = new ApiClient();
export default apiClient;
export { ApiClient };
