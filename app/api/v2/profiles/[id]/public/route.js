/**
 * GET /api/v2/profiles/[id]/public
 * Публичные поля профиля (без email/телефона). Только RENTER / PARTNER / USER.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { formatPrivacyDisplayName } from '@/lib/utils/name-formatter'
import { ReputationService } from '@/lib/services/reputation.service'

export const dynamic = 'force-dynamic'

const PUBLIC_ROLES = new Set(['RENTER', 'PARTNER', 'USER'])

export async function GET(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const id = params?.id
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const { data: p, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar, created_at, is_verified, verification_status, role')
      .eq('id', id)
      .single()

    if (error || !p) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const role = String(p.role || 'USER').toUpperCase()
    if (!PUBLIC_ROLES.has(role)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const rawAvatar = p.avatar && String(p.avatar).trim()

    let partnerTrust = null
    if (role === 'PARTNER') {
      try {
        partnerTrust = await ReputationService.getPartnerTrustPublic(String(p.id))
      } catch (e) {
        console.warn('[public-profile] partner trust', e?.message)
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        displayName: formatPrivacyDisplayName(p.first_name, p.last_name),
        avatar: rawAvatar ? toPublicImageUrl(rawAvatar) : null,
        createdAt: p.created_at,
        isVerified: !!p.is_verified,
        verificationStatus: p.verification_status,
        role,
        partnerTrust,
      },
    })
  } catch (e) {
    console.error('[public-profile]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
