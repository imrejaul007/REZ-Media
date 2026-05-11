/**
 * ReZ Wallet Integration for Creator QR
 */

const WALLET_URL = process.env.REZ_WALLET_URL || 'https://wallet.rezapp.com/api'

export interface WalletBalance {
  coins: number
  cash: number
}

export interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  created_at: string
}

export async function getBalance(userId: string): Promise<WalletBalance> {
  const res = await fetch(`${WALLET_URL}/balance/${userId}`)
  if (!res.ok) return { coins: 0, cash: 0 }
  return res.json()
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const res = await fetch(`${WALLET_URL}/transactions/${userId}`)
  if (!res.ok) return []
  return res.json()
}

export async function creditCreator(
  creatorId: string,
  amount: number,
  source: string
): Promise<boolean> {
  const res = await fetch(`${WALLET_URL}/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: creatorId, amount, source }),
  })
  return res.ok
}
