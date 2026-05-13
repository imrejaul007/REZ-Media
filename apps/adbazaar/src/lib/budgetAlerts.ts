/**
 * Budget alerts for campaign spend tracking
 *
 * Alerts buyers when their campaign reaches 75%, 90%, or 100% of budget
 */

import { createServerClient } from '@/lib/supabase'

export type BudgetAlertThreshold = 75 | 90 | 100

export interface BudgetAlert {
  campaignId: string
  campaignName: string
  buyerId: string
  budget: number
  spent: number
  threshold: BudgetAlertThreshold
  percentage: number
}

export interface BudgetAlertRecord {
  id: string
  campaign_id: string
  threshold: number
  alert_sent_at: string
}

// Lazy initialization to avoid build-time errors
let _supabase: ReturnType<typeof createServerClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createServerClient()
  }
  return _supabase
}

/**
 * Check if any budget alerts should be triggered for a campaign
 * Returns the alert if one should be sent, null if no alert needed
 */
export async function checkBudgetAlerts(campaignId: string): Promise<BudgetAlert | null> {
  const supabase = getSupabase()
  // Fetch the campaign with buyer info
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, buyer_id, budget, total_spent')
    .eq('id', campaignId)
    .single()

  if (!campaign || !campaign.budget || campaign.budget <= 0) {
    return null
  }

  const percentage = (campaign.total_spent / campaign.budget) * 100

  // Check thresholds in order of severity
  const thresholds: BudgetAlertThreshold[] = [75, 90, 100]

  for (const threshold of thresholds) {
    if (percentage >= threshold) {
      // Check if alert already sent for this threshold
      const { data: existing } = await supabase
        .from('budget_alerts')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('threshold', threshold)
        .single()

      if (!existing) {
        // Record the alert in the database
        await supabase.from('budget_alerts').insert({
          campaign_id: campaignId,
          threshold,
          alert_sent_at: new Date().toISOString(),
        })

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          buyerId: campaign.buyer_id,
          budget: campaign.budget,
          spent: campaign.total_spent,
          threshold,
          percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        }
      }
    }
  }

  return null
}

/**
 * Check all active campaigns for budget threshold breaches
 * Called by the budget-alerts cron job
 */
export async function checkAllCampaignBudgetAlerts(): Promise<BudgetAlert[]> {
  const supabase = getSupabase()
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, buyer_id, budget, total_spent')
    .eq('status', 'active')
    .not('budget', 'is', null)
    .gt('budget', 0)

  if (!campaigns?.length) {
    return []
  }

  const alerts: BudgetAlert[] = []

  for (const campaign of campaigns) {
    const percentage = (campaign.total_spent / campaign.budget) * 100
    const thresholds: BudgetAlertThreshold[] = [75, 90, 100]

    for (const threshold of thresholds) {
      if (percentage >= threshold) {
        // Check if alert already sent
        const { data: existing } = await supabase
          .from('budget_alerts')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('threshold', threshold)
          .single()

        if (!existing) {
          // Record the alert
          await supabase.from('budget_alerts').insert({
            campaign_id: campaign.id,
            threshold,
            alert_sent_at: new Date().toISOString(),
          })

          alerts.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            buyerId: campaign.buyer_id,
            budget: campaign.budget,
            spent: campaign.total_spent,
            threshold,
            percentage: Math.round(percentage * 10) / 10,
          })
        }
      }
    }
  }

  return alerts
}

/**
 * Get budget alert history for a campaign
 */
export async function getCampaignBudgetAlerts(
  campaignId: string
): Promise<BudgetAlertRecord[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('budget_alerts')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('threshold', { ascending: false })

  return (data as BudgetAlertRecord[]) ?? []
}
