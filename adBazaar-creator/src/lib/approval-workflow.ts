/**
 * Content Approval Workflow
 * Brand reviews and approves creator content
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient()

export type ApprovalStatus = 'submitted' | 'reviewing' | 'revision_requested' | 'approved' | 'rejected'

export interface ApprovalAction {
  status: ApprovalStatus
  feedback?: string
  revision_notes?: string[]
  reviewed_by?: string
  reviewed_at?: string
}

/**
 * Submit content for review
 */
export async function submitContent(
  contentId: string,
  content: {
    content_url: string
    caption?: string
    hashtags?: string[]
    platform: string
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('creator_deliverables')
    .update({
      content_url: content.content_url,
      content_caption: content.caption,
      content_hashtags: content.hashtags,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', contentId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Brand reviews content
 */
export async function reviewContent(
  contentId: string,
  action: ApprovalAction
): Promise<{ success: boolean; error?: string }> {
  const update: any = {
    status: action.status,
    reviewed_by: action.reviewed_by,
    reviewed_at: new Date().toISOString(),
  }

  if (action.feedback) {
    update.review_notes = action.feedback
  }

  if (action.status === 'revision_requested' && action.revision_notes) {
    update.revision_notes = action.revision_notes
  }

  const { error } = await supabase
    .from('creator_deliverables')
    .update(update)
    .eq('id', contentId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Send notification to creator
  await sendApprovalNotification(contentId, action.status)

  return { success: true }
}

/**
 * Auto-approve content meeting criteria
 */
export async function autoApproveContent(contentId: string): Promise<boolean> {
  // Get content
  const { data: content } = await supabase
    .from('creator_deliverables')
    .select('*')
    .eq('id', contentId)
    .single()

  if (!content) return false

  // Auto-approve criteria
  const criteria = {
    hasImage: content.content_url?.includes('image') || content.content_url?.includes('.jpg') || content.content_url?.includes('.png'),
    hasCaption: content.content_caption?.length > 10,
    hasHashtags: content.content_hashtags?.length > 0,
    meetsGuidelines: true, // Add guideline checks here
  }

  const passed = Object.values(criteria).every(v => v)

  if (passed) {
    await reviewContent(contentId, { status: 'approved' })
  }

  return passed
}

/**
 * Send approval notification (stub)
 */
async function sendApprovalNotification(contentId: string, status: ApprovalStatus): Promise<void> {
  // In production: send email/push notification
  const messages: Record<ApprovalStatus, string> = {
    submitted: 'Content submitted for review',
    reviewing: 'Your content is being reviewed',
    revision_requested: 'Revision requested',
    approved: 'Your content has been approved!',
    rejected: 'Content was not approved',
  }

  console.log(`[Notification] Content ${contentId}: ${messages[status]}`)
}

/**
 * Get content with brand review
 */
export async function getContentForBrandReview(brandId: string) {
  const { data } = await supabase
    .from('creator_deliverables')
    .select(`
      *,
      creators!inner(email, display_name, username)
    `)
    .eq('campaigns.brand_id', brandId)
    .in('status', ['submitted', 'under_review'])
    .order('created_at', { ascending: false })
    .limit(20)

  return data || []
}

/**
 * Get content for creator dashboard
 */
export async function getCreatorContent(creatorId: string) {
  const { data } = await supabase
    .from('creator_deliverables')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  return data || []
}
