/**
 * Social Media API Integration
 * Connects creator profiles to real social accounts
 */

const SOCIAL_APIS = {
  instagram: {
    baseUrl: 'https://graph.instagram.com/v18.0',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
  },
  youtube: {
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    scopes: ['channel_READONLY'],
  },
  tiktok: {
    baseUrl: 'https://open.tiktokapis.com/v2',
    scopes: ['user.info.basic'],
  },
  twitter: {
    baseUrl: 'https://api.twitter.com/2',
    scopes: ['tweet.read', 'users.read'],
  },
}

export interface SocialStats {
  platform: string
  username: string
  followers: number
  following: number
  posts: number
  engagement_rate: number
  verified: boolean
  connected: boolean
  last_sync?: string
}

/**
 * Get Instagram profile stats
 */
export async function getInstagramStats(accessToken: string): Promise<SocialStats> {
  try {
    // Get user info
    const userRes = await fetch(
      `${SOCIAL_APIS.instagram.baseUrl}/me?fields=id,username,followers_count,follows_count,media_count,biography,is_verified&access_token=${accessToken}`
    )
    const user = await userRes.json()

    // Calculate engagement rate from recent posts
    const mediaRes = await fetch(
      `${SOCIAL_APIS.instagram.baseUrl}/me/media?fields=like_count,comments_count&access_token=${accessToken}&limit=12`
    )
    const media = await mediaRes.json()

    const totalEngagement = media.data?.reduce((sum: number, m: any) => sum + (m.like_count || 0) + (m.comments_count || 0), 0) || 0
    const avgEngagement = media.data?.length > 0
      ? totalEngagement / media.data.length
      : 0
    const engagement_rate = user.followers_count > 0
      ? (avgEngagement / user.followers_count) * 100
      : 0

    return {
      platform: 'instagram',
      username: user.username,
      followers: user.followers_count || 0,
      following: user.follows_count || 0,
      posts: user.media_count || 0,
      engagement_rate: Math.round(engagement_rate * 10) / 10,
      verified: user.is_verified || false,
      connected: true,
      last_sync: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Instagram API error:', error)
    return {
      platform: 'instagram',
      username: '',
      followers: 0,
      following: 0,
      posts: 0,
      engagement_rate: 0,
      verified: false,
      connected: false,
    }
  }
}

/**
 * Get YouTube channel stats
 */
export async function getYouTubeStats(accessToken: string): Promise<SocialStats> {
  try {
    const res = await fetch(
      `${SOCIAL_APIS.youtube.baseUrl}/channels?part=snippet,statistics&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()

    const channel = data.items?.[0]
    const stats = channel?.statistics || {}

    return {
      platform: 'youtube',
      username: channel?.snippet?.customUrl || '',
      followers: parseInt(stats.subscriberCount || 0),
      following: 0,
      posts: parseInt(stats.videoCount || 0),
      engagement_rate: 0, // YouTube API requires additional calls
      verified: channel?.brandingSettings?.image?.bannerExternalUrl ? true : false,
      connected: true,
      last_sync: new Date().toISOString(),
    }
  } catch (error) {
    console.error('YouTube API error:', error)
    return {
      platform: 'youtube',
      username: '',
      followers: 0,
      following: 0,
      posts: 0,
      engagement_rate: 0,
      verified: false,
      connected: false,
    }
  }
}

/**
 * Get all social stats for a creator
 */
export async function getAllSocialStats(accounts: { platform: string; access_token: string }[]): Promise<SocialStats[]> {
  const results = await Promise.all(
    accounts.map(async (account) => {
      switch (account.platform) {
        case 'instagram':
          return getInstagramStats(account.access_token)
        case 'youtube':
          return getYouTubeStats(account.access_token)
        default:
          return {
            platform: account.platform,
            username: '',
            followers: 0,
            following: 0,
            posts: 0,
            engagement_rate: 0,
            verified: false,
            connected: false,
          }
      }
    })
  )

  return results
}

/**
 * Calculate creator score based on social stats
 */
export function calculateCreatorScore(stats: SocialStats[]): {
  score: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  badge: string
} {
  const totalFollowers = stats.reduce((sum, s) => sum + s.followers, 0)
  const avgEngagement = stats.reduce((sum, s) => sum + s.engagement_rate, 0) / Math.max(stats.length, 1)
  const verifiedCount = stats.filter(s => s.verified).length

  // Score formula
  const score = Math.min(100, Math.round(
    (Math.log10(totalFollowers + 1) * 10 + // Follower score
    avgEngagement * 2 + // Engagement score
    verifiedCount * 10 // Verified bonus
  ))

  // Tier
  let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze'
  let badge = '🌱 New Creator'

  if (score >= 80) { tier = 'platinum'; badge = '💎 Platinum Creator' }
  else if (score >= 60) { tier = 'gold'; badge = '🏆 Gold Creator' }
  else if (score >= 40) { tier = 'silver'; badge = '⭐ Silver Creator' }

  return { score, tier, badge }
}
