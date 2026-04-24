import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { insertAuditLog } from '@/lib/services/audit/insert-audit-log'
import { rateLimitCheck } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const access = await verifyPartnerAccess(userId)
    if (!access) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const limited = rateLimitCheck(request, 'promo_extend', String(userId))
    if (limited) {
      return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const code = String(params?.code || '')
      .trim()
      .toUpperCase()
    if (!code) {
      return NextResponse.json({ success: false, error: 'Promo code is required' }, { status: 400 })
    }

    let hours = 6
    let extensionSource = 'partner_web'
    try {
      const body = await request.json()
      const parsed = Number(body?.hours)
      if (Number.isFinite(parsed) && parsed > 0) hours = Math.min(24, Math.max(1, Math.round(parsed)))
      const src = String(body?.extensionSource || body?.source || '').trim().toLowerCase()
      if (src === 'telegram_deeplink' || src === 'telegram') extensionSource = 'telegram_deeplink'
    } catch {
      // keep default 6h
    }

    const { data: promoRow, error: promoError } = await supabaseAdmin
      .from('promo_codes')
      .select('id,code,partner_id,created_by_type,is_flash_sale,valid_until,is_active,metadata')
      .eq('code', code)
      .maybeSingle()

    if (promoError) {
      return NextResponse.json({ success: false, error: promoError.message }, { status: 500 })
    }
    if (!promoRow) {
      return NextResponse.json({ success: false, error: 'Promo code not found' }, { status: 404 })
    }
    if (String(promoRow.created_by_type || '').toUpperCase() !== 'PARTNER') {
      return NextResponse.json({ success: false, error: 'Only PARTNER promo can be extended' }, { status: 400 })
    }
    if (String(promoRow.partner_id || '') !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Promo does not belong to partner' }, { status: 403 })
    }
    if (promoRow.is_flash_sale !== true) {
      return NextResponse.json({ success: false, error: 'Promo is not Flash Sale' }, { status: 400 })
    }
    if (promoRow.is_active !== true) {
      return NextResponse.json({ success: false, error: 'Promo is inactive' }, { status: 400 })
    }

    const nowMs = Date.now()
    const currentEndMs = new Date(promoRow.valid_until || '').getTime()
    const baseMs = Number.isFinite(currentEndMs) && currentEndMs > nowMs ? currentEndMs : nowMs
    const nextEndIso = new Date(baseMs + hours * 3600 * 1000).toISOString()
    const metadata = promoRow.metadata && typeof promoRow.metadata === 'object' ? promoRow.metadata : {}
    const nextMetadata = {
      ...metadata,
      last_extended_from_telegram_at: new Date().toISOString(),
      last_extended_hours: hours,
    }

    const { error: updateError } = await supabaseAdmin
      .from('promo_codes')
      .update({ valid_until: nextEndIso, metadata: nextMetadata })
      .eq('id', promoRow.id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    await insertAuditLog({
      userId: String(userId),
      action: 'PARTNER_FLASH_SALE_EXTENDED',
      entityType: 'promo_code',
      entityId: String(promoRow.id),
      payload: {
        code,
        partner_id: String(promoRow.partner_id || userId),
        promo_id: String(promoRow.id),
        hours_added: hours,
        valid_until_after: nextEndIso,
        extension_source: extensionSource,
      },
    })

    return NextResponse.json({
      success: true,
      data: { code, validUntilIso: nextEndIso, hoursAdded: hours, extensionSource },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}

