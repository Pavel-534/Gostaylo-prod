import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isPricingEngineV2EnabledFromEnv,
  isPricingEngineV2Enabled,
} from '@/lib/pricing-engine/feature-flag.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const envOverride = isPricingEngineV2EnabledFromEnv()
  const effective = await isPricingEngineV2Enabled()

  return NextResponse.json({
    success: true,
    data: {
      effective,
      envOverride,
      envVar: process.env.PRICING_ENGINE_V2 || null,
      note: envOverride
        ? 'PRICING_ENGINE_V2 env forces ON — toggle DB flag only affects when env is unset'
        : null,
    },
  })
}

export async function PATCH(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  if (isPricingEngineV2EnabledFromEnv()) {
    return NextResponse.json(
      {
        success: false,
        error: 'ENV_LOCKED',
        message: 'PRICING_ENGINE_V2 env is set — change Vercel env to disable',
      },
      { status: 409 },
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const enabled = Boolean(body.enabled ?? body.pricingEngineV2Enabled)

  const { data: existing } = await supabaseAdmin
    .from('system_settings')
    .select('id, value')
    .eq('key', 'general')
    .maybeSingle()

  const prev = existing?.value && typeof existing.value === 'object' ? existing.value : {}
  const newValue = {
    ...prev,
    pricingEngineV2Enabled: enabled,
    pricing_engine_v2_enabled: enabled,
  }

  let dbResult
  if (existing?.id) {
    dbResult = await supabaseAdmin
      .from('system_settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', 'general')
  } else {
    dbResult = await supabaseAdmin.from('system_settings').insert({
      id: `setting-${Date.now()}`,
      key: 'general',
      value: newValue,
      updated_at: new Date().toISOString(),
    })
  }

  if (dbResult.error) {
    return NextResponse.json({ success: false, error: dbResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: { pricingEngineV2Enabled: enabled, effective: enabled },
  })
}
