import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MarketingNotificationsService } from '@/lib/services/marketing-notifications.service'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export const dynamic = 'force-dynamic'

async function runJob() {
  const nowMs = Date.now()
  const inOneHourMs = nowMs + 60 * 60 * 1000

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('id,code,partner_id,is_flash_sale,is_active,valid_until,metadata,allowed_listing_ids')
    .eq('created_by_type', 'PARTNER')
    .eq('is_flash_sale', true)
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const candidates = (Array.isArray(data) ? data : []).filter((row) => {
    const endMs = new Date(row.valid_until || '').getTime()
    return Number.isFinite(endMs) && endMs > nowMs && endMs <= inOneHourMs
  })

  let sent = 0
  let deduped = 0
  for (const row of candidates) {
    const r = await MarketingNotificationsService.sendPartnerFlashSaleEndingSoonReminder({
      promoRow: row,
    })
    if (r?.deduped) deduped += 1
    if (r?.success) sent += 1
  }

  return NextResponse.json({
    success: true,
    checked: Array.isArray(data) ? data.length : 0,
    notified: sent,
    deduped,
    candidates: candidates.length,
    window: 'next_1h',
  })
}

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  try {
    return await runJob()
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(request) {
  return handle(request)
}

export async function POST(request) {
  return handle(request)
}

