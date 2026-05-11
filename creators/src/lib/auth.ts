/**
 * ReZ Auth Service Integration for Creator QR
 */

const AUTH_SERVICE_URL = process.env.REZ_AUTH_SERVICE_URL || 'https://auth.rezapp.com/api'

export interface User {
  id: string
  phone: string
  email?: string
  name?: string
  created_at: string
}

export async function sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${AUTH_SERVICE_URL}/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  const data = await res.json()
  return data
}

export async function verifyOTP(phone: string, otp: string): Promise<{ success: boolean; token?: string; user?: User }> {
  const res = await fetch(`${AUTH_SERVICE_URL}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  })
  const data = res.json()
  return data
}

export async function getUser(token: string): Promise<User | null> {
  const res = await fetch(`${AUTH_SERVICE_URL}/user/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}
