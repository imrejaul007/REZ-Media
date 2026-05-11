/**
 * REZ Auth Integration for Ads QR
 * Handles phone OTP login, JWT token management, and user session
 */

const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'https://api.rez.money';

// Types
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  isVerified: boolean;
  isOnboarded: boolean;
  profile?: Record<string, unknown>;
}

export interface AuthResponse {
  success: boolean;
  isNewUser?: boolean;
  hasPIN?: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user?: AuthUser;
  deviceRisk?: 'trusted' | 'new' | 'suspicious';
  mfaRequired?: boolean;
  mfaSessionToken?: string;
  message?: string;
}

export interface TokenValidation {
  valid: boolean;
  userId?: string;
  role?: string;
}

// Storage keys
const ACCESS_TOKEN_KEY = 'adsqr_access_token';
const REFRESH_TOKEN_KEY = 'adsqr_refresh_token';
const USER_KEY = 'adsqr_user';

/**
 * Send OTP to phone number
 */
export async function sendOTP(
  phone: string,
  countryCode: string = '+91',
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<{ success: boolean; message: string; messageId?: string }> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, countryCode, channel }),
    });

    const data = await response.json();
    return {
      success: data.success,
      message: data.message || data.error || 'OTP sent successfully',
      messageId: data.messageId,
    };
  } catch (error) {
    console.error('Send OTP error:', error);
    return { success: false, message: 'Failed to send OTP. Please try again.' };
  }
}

/**
 * Verify OTP and complete login
 */
export async function verifyOTP(
  phone: string,
  otp: string,
  countryCode: string = '+91'
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, countryCode }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      // Store tokens
      storeTokens(data.accessToken, data.refreshToken);
      if (data.user) {
        storeUser(data.user);
      }
    }

    return data;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { success: false };
  }
}

/**
 * Complete login with PIN
 */
export async function loginWithPin(
  phone: string,
  pin: string,
  countryCode: string = '+91'
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/login-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken() || ''}`,
      },
      body: JSON.stringify({ phone, pin, countryCode }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      storeTokens(data.accessToken, data.refreshToken);
      if (data.user) {
        storeUser(data.user);
      }
    }

    return data;
  } catch (error) {
    console.error('PIN login error:', error);
    return { success: false };
  }
}

/**
 * Verify MFA code to complete login
 */
export async function verifyMFA(
  mfaSessionToken: string,
  totpCode: string
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/mfa/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaSessionToken, totpCode }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      storeTokens(data.accessToken, data.refreshToken);
      if (data.user) {
        storeUser(data.user);
      }
    }

    return data;
  } catch (error) {
    console.error('MFA verify error:', error);
    return { success: false };
  }
}

/**
 * Set user PIN
 */
export async function setPin(pin: string): Promise<{ success: boolean; message: string }> {
  try {
    const token = getAccessToken();
    if (!token) return { success: false, message: 'Not authenticated' };

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/set-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ pin }),
    });

    const data = await response.json();
    return { success: data.success, message: data.message || 'PIN set successfully' };
  } catch (error) {
    console.error('Set PIN error:', error);
    return { success: false, message: 'Failed to set PIN' };
  }
}

/**
 * Complete user onboarding
 */
export async function completeOnboarding(profile: {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
}, preferences?: Record<string, unknown>): Promise<{ success: boolean; user?: AuthUser }> {
  try {
    const token = getAccessToken();
    if (!token) return { success: false };

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/complete-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profile, preferences }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      storeUser(data.data);
    }

    return data;
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return { success: false };
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const token = getAccessToken();
    if (!token) return null;

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();

    if (data.success && data.data) {
      storeUser(data.data);
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      storeTokens(data.accessToken, data.refreshToken);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Refresh token error:', error);
    return false;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    const token = getAccessToken();
    const refreshToken = getRefreshToken();

    if (token) {
      await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearSession();
  }
}

/**
 * Validate token (internal service call)
 */
export async function validateToken(token: string): Promise<TokenValidation> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
    });

    const data = await response.json();
    return { valid: data.valid, userId: data.userId, role: data.role };
  } catch (error) {
    console.error('Validate token error:', error);
    return { valid: false };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(updates: {
  profile?: Partial<AuthUser['profile']>;
  preferences?: Record<string, unknown>;
}): Promise<{ success: boolean; user?: AuthUser }> {
  try {
    const token = getAccessToken();
    if (!token) return { success: false };

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (data.success && data.data) {
      storeUser(data.data);
      return { success: true, user: data.data };
    }

    return { success: false };
  } catch (error) {
    console.error('Update profile error:', error);
    return { success: false };
  }
}

// Token management utilities
function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function storeUser(user: AuthUser): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }
}

// React hook helper
export function createAuthState() {
  return {
    user: getStoredUser(),
    isAuthenticated: isAuthenticated(),
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
  };
}

// ============================================
// Enhanced Auth Features for Ads QR
// ============================================

// Storage keys for enhanced auth
const DEVICE_FINGERPRINT_KEY = 'adsqr_device_fingerprint';
const SESSION_ID_KEY = 'adsqr_session_id';
const LAST_ACTIVITY_KEY = 'adsqr_last_activity';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface DeviceFingerprint {
  fingerprint: string;
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  timezone: string;
  createdAt: string;
}

export interface SessionInfo {
  sessionId: string;
  deviceFingerprint: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
}

/**
 * Generate device fingerprint
 */
export function generateDeviceFingerprint(): DeviceFingerprint {
  if (typeof window === 'undefined') {
    return {
      fingerprint: '',
      userAgent: '',
      platform: '',
      language: '',
      screenResolution: '',
      timezone: '',
      createdAt: new Date().toISOString(),
    };
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    (navigator as any).deviceMemory || 'unknown',
  ].join('|');

  return {
    fingerprint,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: screen.width + 'x' + screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Store device fingerprint
 */
export function storeDeviceFingerprint(fingerprint: DeviceFingerprint): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, JSON.stringify(fingerprint));
  }
}

/**
 * Get stored device fingerprint
 */
export function getStoredDeviceFingerprint(): DeviceFingerprint | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return `adsqr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Store session info
 */
export function storeSessionInfo(sessionId: string, fingerprint: string): SessionInfo {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);

  const sessionInfo: SessionInfo = {
    sessionId,
    deviceFingerprint: fingerprint,
    createdAt: now.toISOString(),
    lastActivity: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toISOString());
  }

  return sessionInfo;
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_ACTIVITY_KEY, new Date().toISOString());
  }
}

/**
 * Check if session is active and not expired
 */
export function isSessionActive(): boolean {
  if (typeof window === 'undefined') return false;

  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!lastActivity) return false;

  const lastActivityDate = new Date(lastActivity);
  const now = new Date();
  const diff = now.getTime() - lastActivityDate.getTime();

  return diff < SESSION_TIMEOUT_MS;
}

/**
 * Get session info
 */
export function getSessionInfo(): SessionInfo | null {
  if (typeof window === 'undefined') return null;

  const sessionId = localStorage.getItem(SESSION_ID_KEY);
  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  const fingerprint = getStoredDeviceFingerprint();

  if (!sessionId || !lastActivity || !fingerprint) return null;

  const now = new Date();
  const expiresAt = new Date(new Date(lastActivity).getTime() + SESSION_TIMEOUT_MS);

  return {
    sessionId,
    deviceFingerprint: fingerprint.fingerprint,
    createdAt: lastActivity,
    lastActivity,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Validate session with server
 */
export async function validateSession(): Promise<{
  valid: boolean;
  needsRefresh: boolean;
  user?: AuthUser;
}> {
  try {
    const token = getAccessToken();
    if (!token) {
      return { valid: false, needsRefresh: false };
    }

    // Check local session expiry
    if (!isSessionActive()) {
      // Try to refresh token
      const refreshed = await refreshAccessToken();
      return {
        valid: refreshed,
        needsRefresh: !refreshed,
      };
    }

    // Validate with server
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/session/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: localStorage.getItem(SESSION_ID_KEY),
        fingerprint: getStoredDeviceFingerprint(),
      }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        valid: true,
        needsRefresh: false,
        user: data.data.user,
      };
    }

    return { valid: false, needsRefresh: true };
  } catch (error) {
    console.error('Validate session error:', error);
    return { valid: false, needsRefresh: true };
  }
}

/**
 * Enhanced login with device fingerprint
 */
export async function loginWithFingerprint(
  phone: string,
  otp: string,
  countryCode: string = '+91'
): Promise<AuthResponse> {
  try {
    // Generate or retrieve device fingerprint
    let fingerprint = getStoredDeviceFingerprint();
    if (!fingerprint) {
      fingerprint = generateDeviceFingerprint();
      storeDeviceFingerprint(fingerprint);
    }

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otp,
        countryCode,
        deviceFingerprint: fingerprint.fingerprint,
        deviceInfo: {
          userAgent: fingerprint.userAgent,
          platform: fingerprint.platform,
          language: fingerprint.language,
          screenResolution: fingerprint.screenResolution,
          timezone: fingerprint.timezone,
        },
      }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      // Store tokens
      storeTokens(data.accessToken, data.refreshToken);
      if (data.user) {
        storeUser(data.user);
      }

      // Store session info
      if (data.sessionId) {
        storeSessionInfo(data.sessionId, fingerprint.fingerprint);
      }
    }

    return data;
  } catch (error) {
    console.error('Login with fingerprint error:', error);
    return { success: false };
  }
}

/**
 * Silent token refresh with session validation
 */
export async function silentRefresh(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const fingerprint = getStoredDeviceFingerprint();

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken,
        deviceFingerprint: fingerprint?.fingerprint,
      }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      storeTokens(data.accessToken, data.refreshToken);
      updateLastActivity();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Silent refresh error:', error);
    return false;
  }
}

/**
 * Check if user needs re-authentication
 */
export async function checkAuthStatus(): Promise<{
  isAuthenticated: boolean;
  isSessionValid: boolean;
  user?: AuthUser;
  requiresMFA: boolean;
}> {
  try {
    // Check local state first
    if (!isAuthenticated()) {
      return {
        isAuthenticated: false,
        isSessionValid: false,
        requiresMFA: false,
      };
    }

    // Check if session is still active locally
    if (!isSessionActive()) {
      // Try silent refresh
      const refreshed = await silentRefresh();
      if (!refreshed) {
        return {
          isAuthenticated: false,
          isSessionValid: false,
          requiresMFA: false,
        };
      }
    }

    // Get user info
    const user = await getCurrentUser();

    return {
      isAuthenticated: true,
      isSessionValid: true,
      user: user || undefined,
      requiresMFA: false,
    };
  } catch (error) {
    console.error('Check auth status error:', error);
    return {
      isAuthenticated: false,
      isSessionValid: false,
      requiresMFA: false,
    };
  }
}

/**
 * Revoke all sessions for user
 */
export async function revokeAllSessions(): Promise<boolean> {
  try {
    const token = getAccessToken();
    if (!token) return false;

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      clearSession();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return false;
  }
}

/**
 * Get active sessions count
 */
export async function getActiveSessionsCount(): Promise<number> {
  try {
    const token = getAccessToken();
    if (!token) return 0;

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/sessions/count`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && typeof data.count === 'number') {
      return data.count;
    }

    return 0;
  } catch (error) {
    console.error('Get active sessions error:', error);
    return 0;
  }
}
