/**
 * Stage 160 — admin resolution engine (MERGE / REJECT) for location_suggestions.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { validateMergeTarget, guessSynonymLang } from '@/lib/locations/validate-merge-target'
import { invalidateLocationDiscoveryCaches } from '@/lib/locations/invalidate-location-caches'

/**
 * @param {string} message
 */
function mapRpcError(message) {
  const m = String(message || '')
  if (m.includes('SUGGESTION_NOT_FOUND')) return { code: 'NOT_FOUND', status: 404 }
  if (m.includes('SUGGESTION_NOT_PENDING')) return { code: 'NOT_PENDING', status: 409 }
  if (m.includes('INVALID_')) return { code: 'INVALID_PAYLOAD', status: 400 }
  return { code: 'MERGE_FAILED', status: 500 }
}

/**
 * @param {string} suggestionId
 */
async function loadPendingSuggestion(suggestionId) {
  const id = String(suggestionId || '').trim()
  if (!id) return { error: { code: 'INVALID_ID', status: 400, message: 'id required' } }

  const { data, error } = await supabaseAdmin
    .from('location_suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') {
      return { error: { code: 'TABLE_MISSING', status: 503, message: 'apply stage160 migration' } }
    }
    return { error: { code: 'DB_ERROR', status: 500, message: error.message } }
  }

  if (!data) return { error: { code: 'NOT_FOUND', status: 404, message: 'suggestion not found' } }
  if (data.status !== 'PENDING') {
    return { error: { code: 'NOT_PENDING', status: 409, message: `status is ${data.status}` } }
  }

  return { row: data }
}

/**
 * @param {{
 *   suggestionId: string,
 *   target_code: string,
 *   target_type: string,
 *   resolved_by: string,
 *   synonym_lang?: string,
 * }} args
 */
export async function mergeLocationSuggestion(args) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'database unavailable' }
  }

  const loaded = await loadPendingSuggestion(args.suggestionId)
  if (loaded.error) return { ok: false, ...loaded.error }

  const target_code = String(args.target_code || '').trim()
  const target_type = String(args.target_type || '').trim()
  const validation = validateMergeTarget(target_type, target_code)
  if (!validation.ok) {
    return { ok: false, code: 'INVALID_TARGET', status: 400, error: validation.error }
  }

  const synonym_lang = args.synonym_lang || guessSynonymLang(loaded.row.raw_term)

  const { data, error } = await supabaseAdmin.rpc('resolve_location_suggestion_merge_v1', {
    p_suggestion_id: loaded.row.id,
    p_target_code: target_code,
    p_target_type: target_type,
    p_resolved_by: args.resolved_by,
    p_synonym_lang: synonym_lang,
  })

  if (error) {
    if (error.code === '42883' || error.message?.includes('does not exist')) {
      return await mergeLocationSuggestionFallback({
        row: loaded.row,
        target_code,
        target_type,
        resolved_by: args.resolved_by,
        synonym_lang,
      })
    }
    const mapped = mapRpcError(error.message)
    return { ok: false, code: mapped.code, status: mapped.status, error: error.message }
  }

  invalidateLocationDiscoveryCaches()

  return {
    ok: true,
    action: 'MERGE',
    merged_listings_count: data?.merged_listings_count ?? 0,
    synonym_id: data?.synonym_id ?? null,
    suggestion_id: data?.suggestion_id ?? loaded.row.id,
    raw_term: data?.raw_term ?? loaded.row.raw_term,
    target_code: data?.target_code ?? target_code,
    target_type: data?.target_type ?? target_type,
  }
}

/**
 * Non-transactional fallback when RPC not migrated (dev safety).
 * @param {object} args
 */
async function mergeLocationSuggestionFallback(args) {
  const { row, target_code, target_type, resolved_by, synonym_lang } = args
  const rawLower = String(row.raw_term || '').trim().toLowerCase()

  const { data: synRow, error: synErr } = await supabaseAdmin
    .from('geo_synonyms')
    .insert({
      target_code,
      target_type,
      lang: synonym_lang,
      alias_term: row.raw_term,
      weight: 90,
    })
    .select('id')
    .maybeSingle()

  let synonym_id = synRow?.id ?? null
  if (synErr) {
    if (synErr.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('geo_synonyms')
        .select('id')
        .ilike('alias_term', row.raw_term)
        .eq('lang', synonym_lang)
        .maybeSingle()
      synonym_id = existing?.id ?? null
    } else if (synErr.code !== '42P01') {
      return { ok: false, code: 'SYNONYM_FAILED', status: 500, error: synErr.message }
    }
  }

  const listingPatch =
    row.kind === 'city'
      ? { city_code: target_code }
      : { district: target_code }

  const { data: listings, error: listErr } = await supabaseAdmin
    .from('listings')
    .select('id, metadata, district')
    .eq('status', 'ACTIVE')

  if (listErr) {
    return { ok: false, code: 'LISTINGS_READ_FAILED', status: 500, error: listErr.message }
  }

  let merged = 0
  for (const l of listings || []) {
    const d = String(l.district || '').trim().toLowerCase()
    const u = String(l.metadata?.unverified_location?.raw_term || '').trim().toLowerCase()
    if (d !== rawLower && u !== rawLower && l.id !== row.suggested_by_listing_id) continue

    const meta = { ...(l.metadata && typeof l.metadata === 'object' ? l.metadata : {}) }
    meta.geo_status = 'verified'
    delete meta.unverified_location

    const { error: upErr } = await supabaseAdmin
      .from('listings')
      .update({
        ...listingPatch,
        country_code: row.country_code || undefined,
        region_code: row.region_code || undefined,
        city_code: row.kind === 'district' ? row.city_code || undefined : target_code,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', l.id)

    if (!upErr) merged += 1
  }

  const { error: sugErr } = await supabaseAdmin
    .from('location_suggestions')
    .update({
      status: 'MERGED',
      resolved_at: new Date().toISOString(),
      resolved_by,
      merge_target_code: target_code,
      merge_target_type: target_type,
    })
    .eq('id', row.id)
    .eq('status', 'PENDING')

  if (sugErr) {
    return { ok: false, code: 'SUGGESTION_UPDATE_FAILED', status: 500, error: sugErr.message }
  }

  invalidateLocationDiscoveryCaches()

  return {
    ok: true,
    action: 'MERGE',
    merged_listings_count: merged,
    synonym_id: synonym_id,
    suggestion_id: row.id,
    raw_term: row.raw_term,
    target_code,
    target_type,
    fallback: true,
  }
}

/**
 * @param {{
 *   suggestionId: string,
 *   resolved_by: string,
 *   reject_reason?: string,
 * }} args
 */
export async function rejectLocationSuggestion(args) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'database unavailable' }
  }

  const loaded = await loadPendingSuggestion(args.suggestionId)
  if (loaded.error) return { ok: false, ...loaded.error }

  const { data, error } = await supabaseAdmin
    .from('location_suggestions')
    .update({
      status: 'REJECTED',
      resolved_at: new Date().toISOString(),
      resolved_by: args.resolved_by,
      reject_reason: args.reject_reason ? String(args.reject_reason).slice(0, 500) : null,
    })
    .eq('id', loaded.row.id)
    .eq('status', 'PENDING')
    .select('id, raw_term, status')
    .maybeSingle()

  if (error) {
    return { ok: false, code: 'DB_ERROR', status: 500, error: error.message }
  }

  if (!data) {
    return { ok: false, code: 'NOT_PENDING', status: 409, error: 'concurrent update' }
  }

  invalidateLocationDiscoveryCaches()

  return {
    ok: true,
    action: 'REJECT',
    suggestion_id: data.id,
    raw_term: data.raw_term,
  }
}

/**
 * @param {object} payload
 * @param {string} adminUserId
 */
export async function resolveLocationSuggestion(payload, adminUserId) {
  const action = String(payload?.action || '').toUpperCase()
  const suggestionId = String(payload?.suggestionId || payload?.id || '').trim()

  if (action === 'MERGE') {
    return mergeLocationSuggestion({
      suggestionId,
      target_code: payload.target_code,
      target_type: payload.target_type,
      resolved_by: adminUserId,
      synonym_lang: payload.synonym_lang,
    })
  }

  if (action === 'REJECT') {
    return rejectLocationSuggestion({
      suggestionId,
      resolved_by: adminUserId,
      reject_reason: payload.reject_reason,
    })
  }

  return { ok: false, code: 'INVALID_ACTION', status: 400, error: 'action must be MERGE or REJECT' }
}
