import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'

export const dynamic = 'force-dynamic'

async function resolvePartner() {
  const userId = await getUserIdFromSession()
  if (!userId) return { error: 'Unauthorized', status: 401 }
  const partner = await verifyPartnerAccess(userId)
  if (!partner) return { error: 'Partner access denied', status: 403 }
  return { userId }
}

export async function GET(request) {
  const auth = await resolvePartner()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const onlyDefault = searchParams.get('default') === '1'
    if (onlyDefault) {
      const profile = await PayoutRailsService.getPartnerDefaultPayoutProfile(auth.userId)
      return NextResponse.json({ success: true, data: profile ? [profile] : [] })
    }
    const profiles = await PayoutRailsService.listPartnerPayoutProfiles(auth.userId)
    return NextResponse.json({ success: true, data: profiles })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  const auth = await resolvePartner()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const methodId = body.methodId || body.method_id
    if (!methodId) {
      return NextResponse.json({ success: false, error: 'methodId is required' }, { status: 400 })
    }

    const method = await PayoutRailsService.getPayoutMethodById(methodId)
    if (!method || method.is_active === false) {
      return NextResponse.json({ success: false, error: 'Payout method is not available' }, { status: 400 })
    }

    const profileId = body.id || PayoutRailsService.makeProfileId()
    const isDefault = body.isDefault === true || body.is_default === true
    if (isDefault) {
      await supabaseAdmin
        .from('partner_payout_profiles')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('partner_id', auth.userId)
        .eq('is_default', true)
    }

    const payload = {
      id: profileId,
      partner_id: auth.userId,
      method_id: methodId,
      data: body.data && typeof body.data === 'object' ? body.data : {},
      is_verified: false,
      is_default: isDefault,
    }
    const { data, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .insert(payload)
      .select('*, method:payout_methods(*)')
      .single()
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  const auth = await resolvePartner()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const profileId = body.id
    if (!profileId) {
      return NextResponse.json({ success: false, error: 'Profile id is required' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('partner_id', auth.userId)
      .single()
    if (existingError || !existing) {
      return NextResponse.json({ success: false, error: 'Payout profile not found' }, { status: 404 })
    }

    if (existing.is_verified === true) {
      const nextMethodIdPre = body.methodId || body.method_id || existing.method_id
      const nextData =
        body.data && typeof body.data === 'object' ? body.data : existing.data || {}
      const methodChanged = String(nextMethodIdPre) !== String(existing.method_id)
      const dataChanged = JSON.stringify(nextData) !== JSON.stringify(existing.data || {})
      if (methodChanged || dataChanged) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Подтверждённый профиль нельзя изменить. Добавьте новый профиль, назначьте основным и удалите старый.',
          },
          { status: 403 },
        )
      }
    }

    const nextMethodId = body.methodId || body.method_id || existing.method_id
    if (nextMethodId !== existing.method_id) {
      const method = await PayoutRailsService.getPayoutMethodById(nextMethodId)
      if (!method || method.is_active === false) {
        return NextResponse.json({ success: false, error: 'Payout method is not available' }, { status: 400 })
      }
    }

    const isDefault = body.isDefault === true || body.is_default === true
    if (isDefault) {
      await supabaseAdmin
        .from('partner_payout_profiles')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('partner_id', auth.userId)
        .eq('is_default', true)
    }

    const patch = {
      method_id: nextMethodId,
      data: body.data && typeof body.data === 'object' ? body.data : existing.data,
      is_default: isDefault ? true : Boolean(existing.is_default),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .update(patch)
      .eq('id', profileId)
      .eq('partner_id', auth.userId)
      .select('*, method:payout_methods(*)')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const auth = await resolvePartner()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('id')
    if (!profileId) {
      return NextResponse.json({ success: false, error: 'Profile id is required' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('id, is_default')
      .eq('id', profileId)
      .eq('partner_id', auth.userId)
      .maybeSingle()
    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Payout profile not found' }, { status: 404 })
    }
    if (profile.is_default) {
      return NextResponse.json({ success: false, error: 'Default payout profile cannot be deleted' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .delete()
      .eq('id', profileId)
      .eq('partner_id', auth.userId)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
