/**
 * ReZ Mind Integration for Creator QR
 */

const MIND_URL = process.env.REZ_MIND_URL || 'https://mind.rezapp.com/api'

export async function trackIntent(data: {
  userId: string
  action: 'view' | 'book' | 'pay' | 'review'
  creatorId: string
  listingId?: string
  amount?: number
}) {
  await fetch(`${MIND_URL}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    }),
  })
}

export async function getRecommendations(userId: string) {
  const res = await fetch(`${MIND_URL}/recommend?user=${userId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getCreatorStats(creatorId: string) {
  const res = await fetch(`${MIND_URL}/stats/creator/${creatorId}`)
  if (!res.ok) return null
  return res.json()
}
