/**
 * ADR-210 Slice 7 — admin Concierge ops reads (batches journal + partner search).
 * No fee/FX/ledger mutations.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 * }} [opts]
 */
export async function listConciergeImportBatches(opts = {}) {
  const db = opts.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const page = Math.max(1, Number(opts.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await db
    .from('concierge_import_batches')
    .select(
      'id, partner_profile_id, source_type, source_label, mapping_profile, status, created_at, created_by_admin_id, metadata',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: error.message }
  }

  const rows = data || []
  const partnerIds = [...new Set(rows.map((b) => b.partner_profile_id).filter(Boolean))]
  const partnersById = {}
  if (partnerIds.length) {
    const { data: partners } = await db
      .from('profiles')
      .select('id, email, first_name, last_name, is_shadow, shadow_claimed_at, role')
      .in('id', partnerIds)
    for (const p of partners || []) partnersById[p.id] = p
  }

  const listingCounts = await countListingsByBatchIds(
    db,
    rows.map((b) => b.id),
  )

  const items = rows.map((b) =>
    serializeBatchRow(b, partnersById[b.partner_profile_id], listingCounts[b.id] || 0),
  )

  return {
    ok: true,
    page,
    limit,
    total: count ?? items.length,
    items,
  }
}

async function countListingsByBatchIds(db, batchIds) {
  const out = {}
  if (!batchIds?.length) return out
  const { data, error } = await db
    .from('listings')
    .select('id, concierge_batch_id')
    .in('concierge_batch_id', batchIds)
  if (error || !Array.isArray(data)) return out
  for (const row of data) {
    const id = row.concierge_batch_id
    if (!id) continue
    out[id] = (out[id] || 0) + 1
  }
  return out
}

function serializeBatchRow(batch, partner, listingsCount) {
  const isShadow = partner?.is_shadow === true
  const claimed = Boolean(partner?.shadow_claimed_at) && !isShadow
  return {
    id: batch.id,
    partnerProfileId: batch.partner_profile_id,
    sourceType: batch.source_type,
    sourceLabel: batch.source_label,
    mappingProfile: batch.mapping_profile,
    status: batch.status,
    createdAt: batch.created_at,
    createdByAdminId: batch.created_by_admin_id,
    listingsCount,
    partner: partner
      ? {
          id: partner.id,
          email: partner.email,
          firstName: partner.first_name,
          lastName: partner.last_name,
          isShadow,
          shadowClaimedAt: partner.shadow_claimed_at || null,
          role: partner.role,
        }
      : null,
    claimEligible: isShadow === true,
    claimed,
  }
}

/**
 * @param {{
 *   batchId: string,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 * }} input
 */
export async function listConciergeBatchListings(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }
  const batchId = String(input.batchId || '').trim()
  if (!batchId) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'batchId required' }
  }

  const { data: batch, error: batchErr } = await db
    .from('concierge_import_batches')
    .select('id, partner_profile_id, source_type, source_label, status, created_at, metadata')
    .eq('id', batchId)
    .maybeSingle()

  if (batchErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: batchErr.message }
  }
  if (!batch?.id) {
    return { ok: false, status: 404, code: 'BATCH_NOT_FOUND', error: 'Import batch not found' }
  }

  const { data: listings, error } = await db
    .from('listings')
    .select(
      'id, title, status, base_price_thb, import_external_id, import_platform, cover_image, images, metadata, created_at, updated_at',
    )
    .eq('concierge_batch_id', batchId)
    .order('created_at', { ascending: true })

  if (error) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: error.message }
  }

  return {
    ok: true,
    batch: {
      id: batch.id,
      partnerProfileId: batch.partner_profile_id,
      sourceType: batch.source_type,
      sourceLabel: batch.source_label,
      status: batch.status,
      createdAt: batch.created_at,
    },
    listings: (listings || []).map((l) => ({
      id: l.id,
      title: l.title,
      status: l.status,
      basePriceThb: l.base_price_thb,
      importExternalId: l.import_external_id,
      importPlatform: l.import_platform,
      coverImage: l.cover_image,
      images: Array.isArray(l.images) ? l.images.slice(0, 6) : [],
      isDraft: l.metadata?.is_draft === true || l.metadata?.is_draft === 'true',
      conciergeStage: l.metadata?.concierge_stage || null,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })),
  }
}

/**
 * Search live PARTNER profiles (non-shadow) for Concierge ingest assignment.
 * @param {{
 *   q?: string,
 *   limit?: number,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 * }} [opts]
 */
export async function searchConciergePartnerProfiles(opts = {}) {
  const db = opts.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const q = String(opts.q || '').trim().slice(0, 80)
  const limit = Math.min(30, Math.max(1, Number(opts.limit) || 15))

  let query = db
    .from('profiles')
    .select('id, email, first_name, last_name, phone, role, is_shadow, is_verified')
    .eq('role', 'PARTNER')
    .order('created_at', { ascending: false })
    .limit(Math.min(80, limit * 3))

  if (q) {
    const safe = q.replace(/[%_,()"]/g, '')
    if (safe) {
      query = query.or(
        `email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,id.eq.${safe}`,
      )
    }
  }

  const { data, error } = await query
  if (error) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: error.message }
  }

  const items = (data || [])
    .filter((p) => p.is_shadow !== true)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      email: p.email,
      firstName: p.first_name,
      lastName: p.last_name,
      phone: p.phone,
      isVerified: p.is_verified === true,
      label: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id,
    }))

  return { ok: true, items }
}
