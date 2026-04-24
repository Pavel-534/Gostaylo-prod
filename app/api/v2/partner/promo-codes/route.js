/**
 * POST /api/v2/partner/promo-codes — создать промокод PARTNER (partner_id только из сессии).
 * Stage 32.0 — опционально `listingIds[]`: все листинги должны принадлежать партнёру.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { buildPartnerPromoInsert, verifyListingIdsOwnedByPartner } from '@/lib/promo/partner-promo-codes'
import { mapPromoRowToAdminDto } from '@/lib/promo/promo-codes-admin-map'
import { MarketingNotificationsService } from '@/lib/services/marketing-notifications.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const access = await verifyPartnerAccess(userId)
    if (!access) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const { data: promoRows, error: promoError } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('created_by_type', 'PARTNER')
      .eq('partner_id', String(userId))
      .order('created_at', { ascending: false })

    if (promoError) {
      return NextResponse.json({ success: false, error: promoError.message }, { status: 500 })
    }

    const rows = Array.isArray(promoRows) ? promoRows : []
    const promoCodes = rows
      .map((row) => String(row?.code || '').trim().toUpperCase())
      .filter(Boolean)
    const createdByPromo = new Map()
    if (promoCodes.length > 0) {
      const { data: bookingsRows } = await supabaseAdmin
        .from('bookings')
        .select('promo_code_used')
        .in('promo_code_used', promoCodes)
      if (Array.isArray(bookingsRows)) {
        for (const row of bookingsRows) {
          const code = String(row?.promo_code_used || '').trim().toUpperCase()
          if (!code) continue
          createdByPromo.set(code, (createdByPromo.get(code) || 0) + 1)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: rows
        .map((row) => ({
          ...row,
          bookings_created_count: createdByPromo.get(String(row?.code || '').trim().toUpperCase()) || 0,
        }))
        .map(mapPromoRowToAdminDto)
        .filter(Boolean),
    })
  } catch (e) {
    console.error('[PARTNER PROMO CODES GET]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const access = await verifyPartnerAccess(userId)
    if (!access) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const owned = await verifyListingIdsOwnedByPartner(userId, body?.listingIds)
    if (!owned.ok) {
      return NextResponse.json({ success: false, error: owned.error }, { status: 400 })
    }

    let insert
    try {
      insert = buildPartnerPromoInsert(body, userId)
    } catch (e) {
      return NextResponse.json({ success: false, error: e?.message || 'Validation failed' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from('promo_codes').insert(insert).select('*').single()

    if (error) {
      if (String(error.message || '').includes('duplicate') || error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Promo code already exists' }, { status: 409 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (data?.is_flash_sale === true) {
      await MarketingNotificationsService.onPartnerFlashSaleCreated({
        promoRow: data,
        partnerId: userId,
      })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (e) {
    console.error('[PARTNER PROMO CODES POST]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
