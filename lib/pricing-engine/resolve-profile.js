/**
 * Resolve pricing profile by specificity chain (ADR-097).
 * Percents always originate from `pricing_profiles` rows — never hardcoded in JS.
 */

import { supabaseAdmin } from '@/lib/supabase'

function rowToProfile(row) {
  if (!row?.id) return null
  return {
    id: String(row.id),
    name: String(row.name || ''),
    guest_fee_pct: Number(row.guest_fee_pct),
    host_fee_pct: Number(row.host_fee_pct),
    fx_markup_pct: Number(row.fx_markup_pct),
    ru_agent_share_pct: Number(row.ru_agent_share_pct),
    kr_service_share_pct: Number(row.kr_service_share_pct),
    insurance_fund_pct: Number(row.insurance_fund_pct),
    tax_rate_pct: Number(row.tax_rate_pct),
  }
}

async function fetchProfileById(id) {
  if (!id || !supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('pricing_profiles')
    .select(
      'id,name,guest_fee_pct,host_fee_pct,fx_markup_pct,ru_agent_share_pct,kr_service_share_pct,insurance_fund_pct,tax_rate_pct',
    )
    .eq('id', String(id))
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.warn('[PricingEngine] fetchProfileById failed:', id, error.message)
    return null
  }
  return rowToProfile(data)
}

async function fetchDefaultProfileIdFromSettings() {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
  const id = data?.value?.default_pricing_profile_id
  return id ? String(id) : null
}

async function fetchDefaultProfileRow() {
  if (!supabaseAdmin) return null
  const settingsId = await fetchDefaultProfileIdFromSettings()
  if (settingsId) {
    const p = await fetchProfileById(settingsId)
    if (p) return p
  }
  const { data, error } = await supabaseAdmin
    .from('pricing_profiles')
    .select(
      'id,name,guest_fee_pct,host_fee_pct,fx_markup_pct,ru_agent_share_pct,kr_service_share_pct,insurance_fund_pct,tax_rate_pct',
    )
    .eq('is_default', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[PricingEngine] fetchDefaultProfileRow failed:', error.message)
    return null
  }
  return rowToProfile(data)
}

/**
 * @param {string | null | undefined} scopeType
 * @param {string | null | undefined} scopeKey
 */
async function fetchRegionalProfile(scopeType, scopeKey) {
  if (!scopeType || !scopeKey || !supabaseAdmin) return null
  const { data: assignment, error } = await supabaseAdmin
    .from('pricing_profile_assignments')
    .select('pricing_profile_id,priority')
    .eq('scope_type', String(scopeType).toUpperCase())
    .eq('scope_key', String(scopeKey))
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[PricingEngine] fetchRegionalProfile failed:', scopeType, scopeKey, error.message)
    return null
  }
  if (!assignment?.pricing_profile_id) return null
  return fetchProfileById(assignment.pricing_profile_id)
}

/**
 * @param {{
 *   listingId?: string | null,
 *   partnerId?: string | null,
 *   countryCode?: string | null,
 *   cityKey?: string | null,
 *   districtKey?: string | null,
 * }} ctx
 * @returns {Promise<import('./types').PricingProfileResolution>}
 */
export async function resolvePricingProfile(ctx = {}) {
  const trace = []
  const listingId = ctx.listingId ? String(ctx.listingId) : null
  const partnerId = ctx.partnerId ? String(ctx.partnerId) : null

  if (listingId && supabaseAdmin) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('pricing_profile_id')
      .eq('id', listingId)
      .maybeSingle()
    if (listing?.pricing_profile_id) {
      const p = await fetchProfileById(listing.pricing_profile_id)
      if (p) {
        trace.push(`listing:${p.id}`)
        return { profile: p, resolution_trace: trace }
      }
    }
  }

  if (partnerId && supabaseAdmin) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('pricing_profile_id')
      .eq('id', partnerId)
      .maybeSingle()
    if (prof?.pricing_profile_id) {
      const p = await fetchProfileById(prof.pricing_profile_id)
      if (p) {
        trace.push(`profile:${p.id}`)
        return { profile: p, resolution_trace: trace }
      }
    }
  }

  const regionalChecks = [
    ctx.districtKey ? ['DISTRICT', ctx.districtKey] : null,
    ctx.cityKey ? ['CITY', ctx.cityKey] : null,
    ctx.countryCode ? ['COUNTRY', ctx.countryCode] : null,
  ].filter(Boolean)

  for (const [scopeType, scopeKey] of regionalChecks) {
    const p = await fetchRegionalProfile(scopeType, scopeKey)
    if (p) {
      trace.push(`regional:${scopeType}:${scopeKey}`)
      return { profile: p, resolution_trace: trace }
    }
  }

  const def = await fetchDefaultProfileRow()
  if (!def) {
    throw new Error(
      '[PricingEngine] no active pricing profile: set pricing_profiles seed and system_settings.general.default_pricing_profile_id',
    )
  }
  trace.push(`default:${def.id}`)
  return { profile: def, resolution_trace: trace }
}
