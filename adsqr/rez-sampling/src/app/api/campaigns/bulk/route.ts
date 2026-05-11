// AdsQr MVP - Phase 2 - Bulk Campaign Operations
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { extendCampaign } from '@/lib/campaignScheduler'

// POST /api/campaigns/bulk - Execute bulk operations
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, campaign_ids, days_to_extend } = body

  if (!action || !campaign_ids || !Array.isArray(campaign_ids)) {
    return NextResponse.json(
      { error: 'Invalid request: action and campaign_ids required' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  let updated = 0
  const errors: string[] = []

  switch (action) {
    case 'pause_all':
    case 'pause': {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: now })
        .eq('brand_id', user.id)
        .in('id', campaign_ids)
        .eq('status', 'active')

      if (error) {
        errors.push(`Failed to pause campaigns: ${error.message}`)
      } else {
        updated = campaign_ids.length
      }
      break
    }

    case 'activate_all':
    case 'activate': {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: now })
        .eq('brand_id', user.id)
        .in('id', campaign_ids)
        .in('status', ['draft', 'paused'])

      if (error) {
        errors.push(`Failed to activate campaigns: ${error.message}`)
      } else {
        updated = campaign_ids.length
      }
      break
    }

    case 'extend': {
      if (!days_to_extend || days_to_extend < 1) {
        return NextResponse.json(
          { error: 'days_to_extend must be a positive number' },
          { status: 400 }
        )
      }

      for (const campaignId of campaign_ids) {
        const success = await extendCampaign(campaignId, days_to_extend)
        if (success) {
          updated++
        } else {
          errors.push(`Failed to extend campaign ${campaignId}`)
        }
      }
      break
    }

    case 'duplicate': {
      // Get original campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .eq('brand_id', user.id)
        .in('id', campaign_ids)

      if (!campaigns || campaigns.length === 0) {
        return NextResponse.json({ error: 'No campaigns found' }, { status: 404 })
      }

      // Create duplicates
      const duplicates = campaigns.map(c => ({
        brand_id: user.id,
        name: `${c.name} (Copy)`,
        description: c.description,
        offer: c.offer,
        scan_reward: c.scan_reward,
        visit_reward: c.visit_reward,
        purchase_reward: c.purchase_reward,
        brand_coins_reward: c.brand_coins_reward,
        coin_budget: c.coin_budget,
        status: 'draft',
        brand_color: c.brand_color,
        banner_url: c.banner_url,
        landing_template: c.landing_template,
        start_date: null,
        end_date: null,
        created_at: now,
        updated_at: now
      }))

      const { error } = await supabase.from('campaigns').insert(duplicates)

      if (error) {
        errors.push(`Failed to duplicate campaigns: ${error.message}`)
      } else {
        updated = duplicates.length
      }
      break
    }

    case 'delete': {
      // Delete campaigns (only their QR codes and events should cascade or be handled)
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('brand_id', user.id)
        .in('id', campaign_ids)

      if (error) {
        errors.push(`Failed to delete campaigns: ${error.message}`)
      } else {
        updated = campaign_ids.length
      }
      break
    }

    case 'archive': {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'ended', updated_at: now })
        .eq('brand_id', user.id)
        .in('id', campaign_ids)

      if (error) {
        errors.push(`Failed to archive campaigns: ${error.message}`)
      } else {
        updated = campaign_ids.length
      }
      break
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      )
  }

  return NextResponse.json({
    success: true,
    updated,
    errors: errors.length > 0 ? errors : undefined
  })
}

// GET /api/campaigns/bulk - Get bulk operation options/info
export async function GET(_req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get campaign counts by status
  const { data: stats } = await supabase
    .from('campaigns')
    .select('status')
    .eq('brand_id', user.id)

  const statusCounts = {
    total: stats?.length || 0,
    active: stats?.filter(s => s.status === 'active').length || 0,
    paused: stats?.filter(s => s.status === 'paused').length || 0,
    draft: stats?.filter(s => s.status === 'draft').length || 0,
    ended: stats?.filter(s => s.status === 'ended').length || 0
  }

  return NextResponse.json({
    actions: [
      { id: 'pause', label: 'Pause Campaigns', description: 'Temporarily stop active campaigns' },
      { id: 'activate', label: 'Activate Campaigns', description: 'Resume paused or draft campaigns' },
      { id: 'extend', label: 'Extend End Date', description: 'Add days to campaign end dates', requires_days: true },
      { id: 'duplicate', label: 'Duplicate Campaigns', description: 'Create copies of selected campaigns' },
      { id: 'archive', label: 'Archive Campaigns', description: 'Mark campaigns as ended' },
      { id: 'delete', label: 'Delete Campaigns', description: 'Permanently remove campaigns (cannot be undone)' }
    ],
    stats: statusCounts
  })
}
