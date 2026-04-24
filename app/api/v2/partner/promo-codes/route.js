/**
 * POST /api/v2/partner/promo-codes — создать промокод PARTNER (partner_id только из сессии).
 * Stage 32.0 — опционально `listingIds[]`: все листинги должны принадлежать партнёру.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { buildPartnerPromoInsert, verifyListingIdsOwnedByPartner } from '@/lib/promo/partner-promo-codes'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (e) {
    console.error('[PARTNER PROMO CODES POST]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
