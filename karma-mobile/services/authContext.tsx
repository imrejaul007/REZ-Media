/**
 * Auth Context for Karma Mobile App
 * Secure JWT auth with expo-secure-store for token storage
 * Following consumer app patterns for security
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import { setSentryUser } from './sentry';

// Secure storage keys (tokens should never be in AsyncStorage)
const TOKEN_KEY = 'rez_karma_auth_token';
const TOKEN_CREATED_KEY = 'rez_karma_token_created';
const USER_KEY = 'rez_karma_user'; // User data can be in AsyncStorage
const DEVICE_FINGERPRINT_KEY = 'rez_karma_device_fp';

export interface AuthUser {
  userId: string;
  phone?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isOnboarded?: boolean;
  createdAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (phoneNumber: string, otp: string) => Promise<AuthUser | undefined>;
  register: (phoneNumber: string, email: string) => Promise<void>;
  sendOTP: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Generate a simple device fingerprint
 */
async function getDeviceFingerprint(): Promise<string> {
  try {
    let fingerprint = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
    if (!fingerprint) {
      // Generate a random fingerprint
      fingerprint = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      await SecureStore.setItemAsync(DEVICE_FINGERPRINT_KEY, fingerprint);
    }
    return fingerprint;
  } catch {
    // Fallback if SecureStore fails
    return `fp-${Date.now()}`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get token from secure storage
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        // Verify token isn't expired
        const tokenCreated = await SecureStore.getItemAsync(TOKEN_CREATED_KEY);
        if (tokenCreated) {
          const age = Date.now() - parseInt(tokenCreated, 10);
          const sevenDays = 7 * 24 * 60 * 60 * 1000;

          if (age > sevenDays) {
            // Token too old, clear it
            await clearSecureStorage();
            setIsLoading(false);
            return;
          }
        }

        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Set Sentry user for error tracking
        const parsedUser = JSON.parse(storedUser);
        setSentryUser(parsedUser.userId, {
          phone: parsedUser.phone,
          email: parsedUser.email,
        });

        // Set token in API client
        await apiClient.setToken(storedToken);
      }
    } catch (err) {
      console.error('[Auth] Error checking auth status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (phoneNumber: string, otp: string): Promise<AuthUser | undefined> => {
    try {
      setError(null);
      setIsLoading(true);

      const deviceFingerprint = await getDeviceFingerprint();

      const response = await apiClient.post<{ user: AuthUser; token: string }>('/auth/login', {
        phoneNumber,
        otp,
        deviceFingerprint,
      });

      if (response.success && response.data) {
        const { user: loggedInUser, token: authToken } = response.data;

        // Store token securely
        await SecureStore.setItemAsync(TOKEN_KEY, authToken);
        await SecureStore.setItemAsync(TOKEN_CREATED_KEY, Date.now().toString());

        // Store user data (not sensitive)
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));

        // Set token in API client
        await apiClient.setToken(authToken);

        // Set Sentry user
        setSentryUser(loggedInUser.userId, {
          phone: loggedInUser.phone,
          email: loggedInUser.email,
        });

        setToken(authToken);
        setUser(loggedInUser);

        return loggedInUser;
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (phoneNumber: string, email: string): Promise<void> => {
    try {
      setError(null);

      const response = await apiClient.post('/auth/register', { phoneNumber, email });

      if (!response.success) {
        setError(response.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    }
  }, []);

  const sendOTP = useCallback(async (phoneNumber: string): Promise<void> => {
    try {
      setError(null);

      const response = await apiClient.post('/auth/otp/send', { phoneNumber });

      if (!response.success) {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending OTP');
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Clear secure storage
      await clearSecureStorage();

      // Clear user data
      await AsyncStorage.removeItem(USER_KEY);

      // Clear API client token
      await apiClient.clearToken();

      // Clear Sentry user
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('[Auth] Error during logout:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>): Promise<void> => {
    try {
      setError(null);

      const response = await apiClient.patch('/auth/profile', data);

      if (response.success && response.data) {
        // Update stored user data
        const updatedUser = response.data as unknown as AuthUser;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);

        // Update Sentry user
        setSentryUser(updatedUser.userId, {
          phone: updatedUser.phone,
          email: updatedUser.email,
        });
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating profile');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!token && !!user,
        token,
        error,
        login,
        register,
        sendOTP,
        logout,
        updateProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

async function clearSecureStorage(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_CREATED_KEY);
  } catch (err) {
    console.error('[Auth] Error clearing secure storage:', err);
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
