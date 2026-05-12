/**
 * DOOH Email Notifications
 * Sends emails via Resend
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = 'DOOH <notifications@rez.money>'

interface EmailData {
  to: string
  subject: string
  html: string
}

/**
 * Send email via Resend
 */
async function sendEmail(data: EmailData): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[Email] Would send:', data.subject, 'to', data.to)
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    })

    return res.ok
  } catch (error) {
    console.error('[Email] Failed:', error)
    return false
  }
}

// Email Templates

/**
 * Screen registered
 */
export async function sendScreenRegistered(email: string, screenName: string, screenId: string) {
  return sendEmail({
    to: email,
    subject: '🎉 Your screen is registered!',
    html: `
      <h1>Screen Registered</h1>
      <p>Great news! Your screen <strong>${screenName}</strong> is now part of the DOOH network.</p>
      <p><strong>Screen ID:</strong> ${screenId}</p>
      <p>Next steps:</p>
      <ol>
        <li>Install the DOOH Screen App on your display</li>
        <li>Configure with your Screen ID</li>
        <li>Start earning from ads!</li>
      </ol>
      <p><a href="https://dooh.rez.money/setup">Setup Guide</a></p>
    `,
  })
}

/**
 * Screen offline alert
 */
export async function sendScreenOffline(email: string, screenName: string, lastSeen: string) {
  return sendEmail({
    to: email,
    subject: '⚠️ Screen Offline',
    html: `
      <h1>Screen Offline Alert</h1>
      <p>Your screen <strong>${screenName}</strong> hasn't sent a heartbeat recently.</p>
      <p><strong>Last seen:</strong> ${lastSeen}</p>
      <p>Please check:</p>
      <ul>
        <li>Is the screen powered on?</li>
        <li>Is there internet connectivity?</li>
        <li>Is the app running?</li>
      </ul>
      <p><a href="https://dooh.rez.money/dashboard">View Dashboard</a></p>
    `,
  })
}

/**
 * Payout processed
 */
export async function sendPayoutProcessed(email: string, amount: number, method: string) {
  return sendEmail({
    to: email,
    subject: '💰 Payout Processed',
    html: `
      <h1>Payout Processed!</h1>
      <p>Your earnings of <strong>₹${amount.toFixed(2)}</strong> have been processed.</p>
      <p><strong>Method:</strong> ${method}</p>
      <p>It should arrive in your account within 2-3 business days.</p>
      <p><a href="https://dooh.rez.money/earnings">View Earnings</a></p>
    `,
  })
}

/**
 * Weekly summary
 */
export async function sendWeeklySummary(
  email: string,
  stats: {
    screens: number
    impressions: number
    scans: number
    earnings: number
  }
) {
  return sendEmail({
    to: email,
    subject: '📊 Your Weekly DOOH Report',
    html: `
      <h1>Weekly Report</h1>
      <p>Here's how your screens performed this week:</p>
      <table>
        <tr><td>Screens</td><td>${stats.screens}</td></tr>
        <tr><td>Impressions</td><td>${stats.impressions.toLocaleString()}</td></tr>
        <tr><td>QR Scans</td><td>${stats.scans.toLocaleString()}</td></tr>
        <tr><td>Earnings</td><td>₹${stats.earnings.toFixed(2)}</td></tr>
      </table>
      <p><a href="https://dooh.rez.money/dashboard">View Dashboard</a></p>
    `,
  })
}

/**
 * New campaign available
 */
export async function sendNewCampaign(email: string, campaignName: string, rate: number) {
  return sendEmail({
    to: email,
    subject: '📢 New Campaign Available',
    html: `
      <h1>New Campaign</h1>
      <p>A new campaign is running on your screen type:</p>
      <p><strong>${campaignName}</strong></p>
      <p><strong>Rate:</strong> ₹${rate} per 1000 impressions</p>
      <p><a href="https://dooh.rez.money/campaigns">View Campaign</a></p>
    `,
  })
}
