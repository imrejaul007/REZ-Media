/**
 * Creator System Notifications
 * Email + Push notifications
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[Email] Would send: ${subject} to ${to}`)
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Creators <noreply@rez.money>',
        to,
        subject,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Creator Notifications
export async function notifyCreatorNewCampaign(creator: { email: string; name: string }, campaign: { brand: string; title: string }) {
  return sendEmail(creator.email, `New Campaign: ${campaign.title}`, `
    <h1>New Campaign Available</h1>
    <p>Hi ${creator.name},</p>
    <p><strong>${campaign.brand}</strong> posted a new campaign: ${campaign.title}</p>
    <p><a href="https://creators.rez.money/campaigns">View Campaign</a></p>
  `)
}

export async function notifyCreatorContentApproved(creator: { email: string; name: string }, content: { title: string; brand: string }) {
  return sendEmail(creator.email, 'Content Approved! 🎉', `
    <h1>Your content was approved!</h1>
    <p>Hi ${creator.name},</p>
    <p>Great news! <strong>${content.brand}</strong> approved your content: ${content.title}</p>
    <p>You'll receive payment within 7 days.</p>
    <p><a href="https://creators.rez.money/dashboard">View Dashboard</a></p>
  `)
}

export async function notifyCreatorRevision(content: { title: string; feedback: string }) {
  return sendEmail(content.email, 'Revision Requested', `
    <h1>Revision Needed</h1>
    <p>The brand requested changes to your content: ${content.title}</p>
    <p>Feedback: ${content.feedback}</p>
    <p><a href="https://creators.rez.money/content">Update Content</a></p>
  `)
}

export async function notifyCreatorPayment(creator: { email: string }, payment: { amount: number; campaign: string }) {
  return sendEmail(creator.email, 'Payment Received! 💰', `
    <h1>Payment Processed</h1>
    <p>You received <strong>₹${payment.amount}</strong> for: ${payment.campaign}</p>
    <p><a href="https://creators.rez.money/earnings">View Earnings</a></p>
  `)
}

// Brand Notifications
export async function notifyBrandNewApplication(brand: { email: string }, application: { creator: string; campaign: string }) {
  return sendEmail(brand.email, 'New Creator Application', `
    <h1>New Application</h1>
    <p><strong>${application.creator}</strong> applied to your campaign: ${application.campaign}</p>
    <p><a href="https://creators.rez.money/admin/applications">Review Application</a></p>
  `)
}

export async function notifyBrandContentSubmitted(brand: { email: string }, content: { creator: string; type: string }) {
  return sendEmail(brand.email, 'Content Submitted for Review', `
    <h1>Content Submitted</h1>
    <p><strong>${content.creator}</strong> submitted ${content.type} content for your campaign.</p>
    <p><a href="https://creators.rez.money/admin/content">Review Content</a></p>
  `)
}

// DOOH Notifications
export async function notifyCreatorDOOHScan(creator: { email: string }, stats: { scans: number; earnings: number }) {
  return sendEmail(creator.email, 'DOOH Scan Update 📊', `
    <h1>Your content is getting views!</h1>
    <p>Today: <strong>${stats.scans} scans</strong> • Earned <strong>₹${stats.earnings}</strong></p>
    <p><a href="https://creators.rez.money/dooh">View DOOH Dashboard</a></p>
  `)
}
