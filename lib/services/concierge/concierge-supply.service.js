/**
 * ADR-210 Slice 2 — Concierge Supply: shadow partner provision + listing ingest.
 * Admin / service-role DB writes only; does not touch guest UI or fee/FX SSOT.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveHostCommissionPercentFromGeneral } from '@/lib/services/pricing/pricing-fee-policy.js'
import { applyListingMaxCapacitySyncToRow } from '@/lib/listing-guest-capacity.js'
import {
  filterConciergeImagesWithDriveGuard,
  rehostConciergeMedia,
} from '@/lib/services/concierge/concierge-media.service.js'

export const CONCIERGE_IMPORT_PLATFORM = 'concierge'

const SOURCE_TYPES = new Set(['pdf', 'xlsx', 'gsheet', 'json'])

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeReferralCode(profileId) {
  const clean = String(profileId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase()
  return `AIR-${clean || Math.floor(100000 + Math.random() * 900000)}`
}

export function normalizeConciergeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: null, lastName: null }
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  }
}

/**
 * HTTPS-only image URLs. Drive folder/view links are skipped with mediaWarnings (Slice 4).
 * @param {unknown} images
 * @returns {string[]}
 */
export function filterHttpsImageUrls(images) {
  return filterConciergeImagesWithDriveGuard(images).images
}

/**
 * @param {unknown} images
 * @returns {{ images: string[], mediaWarnings: Array<{ url: string, code: string, message: string }> }}
 */
export function filterConciergeListingImages(images) {
  return filterConciergeImagesWithDriveGuard(images)
}

/**
 * @param {unknown} icalUrl
 * @returns {object|null}
 */
export function buildConciergeSyncSettings(icalUrl) {
  const url = String(icalUrl || '').trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return null
  return {
    sources: [
      {
        id: makeId('src'),
        url,
        platform: 'other',
        enabled: true,
        added_at: new Date().toISOString(),
        status: 'active',
        last_sync: null,
        events_count: 0,
      },
    ],
    auto_sync: true,
    last_sync: null,
  }
}

/**
 * @param {object} item
 * @returns {{ ok: true, value: object } | { ok: false, error: string, code: string }}
 */
export function validateConciergeListingItem(item) {
  if (!item || typeof item !== 'object') {
    return { ok: false, error: 'listing item required', code: 'VALIDATION_ERROR' }
  }
  const externalId = String(item.externalId || '').trim()
  const title = String(item.title || '').trim()
  const basePriceThb = Number(item.basePriceThb)
  if (!externalId) {
    return { ok: false, error: 'externalId required', code: 'VALIDATION_ERROR' }
  }
  if (!title) {
    return { ok: false, error: 'title required', code: 'VALIDATION_ERROR' }
  }
  if (!Number.isFinite(basePriceThb) || basePriceThb <= 0) {
    return { ok: false, error: 'basePriceThb must be > 0', code: 'VALIDATION_ERROR' }
  }
  const seasons = Array.isArray(item.seasons) ? item.seasons : []
  for (const s of seasons) {
    const startDate = String(s?.startDate || '').trim()
    const endDate = String(s?.endDate || '').trim()
    const priceDaily = Number(s?.priceDaily)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { ok: false, error: `invalid season dates for ${externalId}`, code: 'VALIDATION_ERROR' }
    }
    if (!Number.isFinite(priceDaily) || priceDaily <= 0) {
      return { ok: false, error: `invalid priceDaily for ${externalId}`, code: 'VALIDATION_ERROR' }
    }
  }
  const { images, mediaWarnings } = filterConciergeListingImages(item.images)
  return {
    ok: true,
    value: {
      externalId,
      title,
      description: String(item.description || '').trim() || title,
      categorySlug: String(item.categorySlug || 'stay').trim().toLowerCase() || 'stay',
      bedrooms: item.bedrooms != null ? Number(item.bedrooms) : null,
      bathrooms: item.bathrooms != null ? Number(item.bathrooms) : null,
      maxGuests: item.maxGuests != null ? Number(item.maxGuests) : null,
      sqm: item.sqm != null ? Number(item.sqm) : null,
      geo: item.geo && typeof item.geo === 'object' ? item.geo : {},
      basePriceThb,
      seasons,
      images,
      mediaWarnings,
      icalUrl: item.icalUrl ? String(item.icalUrl).trim() : '',
    },
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} slug
 */
export async function resolveCategoryIdBySlug(db, slug) {
  const wanted = String(slug || 'stay').trim().toLowerCase()
  const candidates = [wanted]
  if (wanted === 'stay') candidates.push('stays', 'property', 'housing')
  if (wanted === 'stays') candidates.push('stay', 'property')

  const { data: rows, error } = await db.from('categories').select('id, slug').limit(200)
  if (error) throw new Error(error.message || 'CATEGORIES_LOOKUP_FAILED')
  const list = Array.isArray(rows) ? rows : []
  for (const c of candidates) {
    const hit = list.find((r) => String(r.slug || '').toLowerCase() === c)
    if (hit?.id) return String(hit.id)
  }
  if (list[0]?.id) return String(list[0].id)
  throw new Error('NO_CATEGORIES_AVAILABLE')
}

/**
 * @param {{
 *   email: string,
 *   fullName?: string,
 *   phone?: string,
 *   createdByAdminId?: string|null,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 * }} input
 */
export async function provisionConciergeShadowPartner(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const email = normalizeConciergeEmail(input.email)
  if (!email || !email.includes('@')) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'Valid email required' }
  }

  const { data: existing, error: readErr } = await db
    .from('profiles')
    .select('id, email, role, is_shadow, first_name, last_name, phone, shadow_claimed_at, created_at')
    .eq('email', email)
    .maybeSingle()

  if (readErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: readErr.message || 'Profile lookup failed' }
  }

  if (existing?.id) {
    if (existing.is_shadow === true) {
      return {
        ok: true,
        status: 200,
        reused: true,
        profile: existing,
      }
    }
    return {
      ok: false,
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      error: 'A non-shadow profile already exists for this email',
      profileId: existing.id,
    }
  }

  const { firstName, lastName } = splitFullName(input.fullName)
  const profileId = makeId('partner-shadow')
  const now = new Date().toISOString()
  const row = {
    id: profileId,
    email,
    password_hash: null,
    role: 'PARTNER',
    first_name: firstName,
    last_name: lastName,
    phone: input.phone ? String(input.phone).trim() : null,
    referral_code: makeReferralCode(profileId),
    is_verified: false,
    verification_status: 'PENDING',
    preferred_currency: 'THB',
    preferred_payout_currency: 'THB',
    language: 'ru',
    is_shadow: true,
    shadow_claimed_at: null,
    created_at: now,
    updated_at: now,
  }

  const { data: created, error: insertErr } = await db
    .from('profiles')
    .insert(row)
    .select('id, email, role, is_shadow, first_name, last_name, phone, shadow_claimed_at, created_at')
    .single()

  if (insertErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: insertErr.message || 'Profile create failed' }
  }

  return {
    ok: true,
    status: 201,
    reused: false,
    profile: created,
    createdByAdminId: input.createdByAdminId || null,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} listingId
 * @param {Array<{ startDate: string, endDate: string, priceDaily: number, priceMonthly?: number, label?: string }>} seasons
 */
async function replaceSeasonalPrices(db, listingId, seasons) {
  const { error: delErr } = await db.from('seasonal_prices').delete().eq('listing_id', listingId)
  if (delErr) throw new Error(delErr.message || 'SEASONAL_DELETE_FAILED')

  if (!Array.isArray(seasons) || seasons.length === 0) return

  const rows = seasons.map((s) => {
    const priceMonthly = s.priceMonthly != null ? Number(s.priceMonthly) : null
    return {
      id: makeId('season'),
      listing_id: listingId,
      start_date: String(s.startDate).trim(),
      end_date: String(s.endDate).trim(),
      price_daily: Number(s.priceDaily),
      price_monthly: Number.isFinite(priceMonthly) && priceMonthly > 0 ? priceMonthly : null,
      season_type: 'NORMAL',
      label: s.label ? String(s.label).trim() : null,
      min_stay: 1,
    }
  })

  const { error: insErr } = await db.from('seasonal_prices').insert(rows)
  if (insErr) {
    // Some envs auto-generate seasonal id — retry without id
    const withoutIds = rows.map(({ id: _id, ...rest }) => rest)
    const { error: retryErr } = await db.from('seasonal_prices').insert(withoutIds)
    if (retryErr) throw new Error(retryErr.message || 'SEASONAL_INSERT_FAILED')
  }
}

/**
 * @param {{
 *   partnerProfileId: string,
 *   sourceType: string,
 *   sourceLabel?: string,
 *   mappingProfile?: string,
 *   listings: object[],
 *   createdByAdminId?: string|null,
 *   autoRehostMedia?: boolean,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   rehostFn?: typeof rehostConciergeMedia,
 * }} input
 */
export async function ingestConciergeListings(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const partnerProfileId = String(input.partnerProfileId || '').trim()
  const sourceType = String(input.sourceType || '').trim().toLowerCase()
  const listingsIn = Array.isArray(input.listings) ? input.listings : null
  const autoRehostMedia = input.autoRehostMedia !== false

  if (!partnerProfileId) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'partnerProfileId required' }
  }
  if (!SOURCE_TYPES.has(sourceType)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: 'sourceType must be pdf|xlsx|gsheet|json',
    }
  }
  if (!listingsIn || listingsIn.length === 0) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'listings array required' }
  }

  const validated = []
  /** @type {Array<{ externalId?: string, url: string, code: string, message: string }>} */
  const mediaWarnings = []
  for (const item of listingsIn) {
    const v = validateConciergeListingItem(item)
    if (!v.ok) return { ok: false, status: 400, code: v.code, error: v.error }
    validated.push(v.value)
    for (const w of v.value.mediaWarnings || []) {
      mediaWarnings.push({ ...w, externalId: v.value.externalId })
    }
  }

  const { data: partner, error: partnerErr } = await db
    .from('profiles')
    .select('id, role, is_shadow, email, custom_commission_rate')
    .eq('id', partnerProfileId)
    .maybeSingle()

  if (partnerErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: partnerErr.message }
  }
  if (!partner?.id) {
    return { ok: false, status: 404, code: 'PARTNER_NOT_FOUND', error: 'Partner profile not found' }
  }
  if (String(partner.role || '').toUpperCase() !== 'PARTNER') {
    return {
      ok: false,
      status: 400,
      code: 'PARTNER_ROLE_REQUIRED',
      error: 'Target profile must have role PARTNER',
    }
  }

  let commissionRate = 0
  try {
    const partnerComm = parseFloat(partner.custom_commission_rate)
    if (Number.isFinite(partnerComm) && partnerComm >= 0) {
      commissionRate = partnerComm
    } else {
      const { readSystemSettingValue } = await import('@/lib/admin/system-settings-store')
      const general = (await readSystemSettingValue('general')) || {}
      commissionRate = resolveHostCommissionPercentFromGeneral(general)
    }
  } catch {
    commissionRate = 0
  }

  const batchId = makeId('batch')
  const now = new Date().toISOString()
  const { error: batchErr } = await db.from('concierge_import_batches').insert({
    id: batchId,
    partner_profile_id: partnerProfileId,
    source_type: sourceType,
    source_label: input.sourceLabel ? String(input.sourceLabel).trim() : null,
    mapping_profile: input.mappingProfile ? String(input.mappingProfile).trim() : null,
    status: 'open',
    created_by_admin_id: input.createdByAdminId || null,
    created_at: now,
    metadata: {
      stage: '210.2',
      listing_count: validated.length,
      media_warnings: mediaWarnings,
    },
  })

  if (batchErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: batchErr.message || 'Batch create failed' }
  }

  /** @type {string[]} */
  const listingIds = []
  /** @type {string[]} */
  const createdListingIds = []
  const warnings = []

  try {
    const categoryCache = new Map()

    for (const item of validated) {
      let categoryId = categoryCache.get(item.categorySlug)
      if (!categoryId) {
        categoryId = await resolveCategoryIdBySlug(db, item.categorySlug)
        categoryCache.set(item.categorySlug, categoryId)
      }

      const { data: existingRows, error: existErr } = await db
        .from('listings')
        .select('id, metadata, sync_settings')
        .eq('owner_id', partnerProfileId)
        .eq('import_platform', CONCIERGE_IMPORT_PLATFORM)
        .eq('import_external_id', item.externalId)
        .limit(1)

      if (existErr) throw new Error(existErr.message || 'LISTING_LOOKUP_FAILED')

      const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null
      const listingId = existing?.id || makeId('listing')

      const geo = item.geo || {}
      const lat = geo.lat != null ? Number(geo.lat) : null
      const lng = geo.lng != null ? Number(geo.lng) : null
      const addressText = geo.addressText ? String(geo.addressText).trim() : ''

      const prevMeta =
        existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}

      const metadata = {
        ...prevMeta,
        is_draft: true,
        concierge_protected: true,
        concierge_stage: 'imported_draft',
        concierge_batch_id: batchId,
        ...(Number.isFinite(item.bedrooms) ? { bedrooms: item.bedrooms } : {}),
        ...(Number.isFinite(item.bathrooms) ? { bathrooms: item.bathrooms } : {}),
        ...(Number.isFinite(item.maxGuests) ? { max_guests: item.maxGuests } : {}),
        ...(Number.isFinite(item.sqm) ? { sqm: item.sqm } : {}),
        ...(addressText ? { address: addressText, address_text: addressText } : {}),
      }

      const syncSettings = buildConciergeSyncSettings(item.icalUrl)

      const row = {
        owner_id: partnerProfileId,
        category_id: categoryId,
        status: 'INACTIVE',
        title: item.title,
        description: item.description,
        district: addressText || '',
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        base_price_thb: item.basePriceThb,
        base_currency: 'THB',
        commission_rate: commissionRate,
        images: item.images,
        cover_image: item.images[0] || null,
        metadata,
        available: false,
        instant_booking: false,
        import_platform: CONCIERGE_IMPORT_PLATFORM,
        import_external_id: item.externalId,
        last_imported_at: now,
        concierge_batch_id: batchId,
        updated_at: now,
      }

      if (syncSettings) {
        row.sync_settings = syncSettings
      } else if (!existing) {
        row.sync_settings = {}
      }

      applyListingMaxCapacitySyncToRow(row, {
        categorySlug: item.categorySlug,
        existing: { metadata },
      })

      if (existing?.id) {
        const { error: updErr } = await db.from('listings').update(row).eq('id', existing.id)
        if (updErr) throw new Error(updErr.message || 'LISTING_UPDATE_FAILED')
        listingIds.push(existing.id)
      } else {
        row.id = listingId
        row.created_at = now
        const { error: insErr } = await db.from('listings').insert(row)
        if (insErr) throw new Error(insErr.message || 'LISTING_INSERT_FAILED')
        createdListingIds.push(listingId)
        listingIds.push(listingId)
      }

      try {
        await replaceSeasonalPrices(db, listingIds[listingIds.length - 1], item.seasons)
      } catch (seasonErr) {
        warnings.push({
          externalId: item.externalId,
          listingId: listingIds[listingIds.length - 1],
          warning: seasonErr?.message || 'seasonal upsert failed',
        })
      }
    }

    const { error: finishErr } = await db
      .from('concierge_import_batches')
      .update({
        status: 'ingested',
        metadata: {
          stage: '210.2',
          listing_count: listingIds.length,
          listing_ids: listingIds,
          warnings,
          media_warnings: mediaWarnings,
        },
      })
      .eq('id', batchId)

    if (finishErr) throw new Error(finishErr.message || 'BATCH_FINISH_FAILED')

    /** @type {object|null} */
    let mediaRehost = null
    if (autoRehostMedia && listingIds.length > 0) {
      try {
        const runRehost = input.rehostFn || rehostConciergeMedia
        mediaRehost = await runRehost({
          batchId,
          listingIds,
          db,
        })
        if (mediaRehost && mediaRehost.ok === false) {
          warnings.push({
            warning: mediaRehost.error || 'auto rehost failed',
            code: mediaRehost.code || 'REHOST_FAILED',
          })
        }
      } catch (rehostErr) {
        warnings.push({
          warning: rehostErr?.message || 'auto rehost exception',
          code: 'REHOST_EXCEPTION',
        })
        mediaRehost = {
          ok: false,
          error: rehostErr?.message || String(rehostErr),
        }
      }
    }

    /** @type {object|null} */
    let partnerNotify = null
    if (partner.is_shadow !== true && input.notifyExistingPartner !== false) {
      try {
        const { notifyExistingPartnerConciergeIngest } = await import(
          '@/lib/services/concierge/concierge-partner-notify.service.js'
        )
        partnerNotify = await notifyExistingPartnerConciergeIngest({
          partnerProfileId,
          email: partner.email,
          batchId,
          listingsCount: listingIds.length,
          db,
          sendEmail: input.sendPartnerEmail !== false,
        })
      } catch (notifyErr) {
        warnings.push({
          warning: notifyErr?.message || 'partner notify failed',
          code: 'PARTNER_NOTIFY_FAILED',
        })
        partnerNotify = { ok: false, error: notifyErr?.message || String(notifyErr) }
      }
    }

    return {
      ok: true,
      status: 200,
      batchId,
      importedListingsCount: listingIds.length,
      listingIds,
      warnings,
      mediaWarnings,
      mediaRehost,
      partnerNotify,
    }
  } catch (err) {
    // Compensating wrapper (PostgREST has no multi-statement txn): cancel batch; remove rows created in this run.
    try {
      await db
        .from('concierge_import_batches')
        .update({
          status: 'cancelled',
          metadata: {
            stage: '210.2',
            error: err?.message || String(err),
            created_listing_ids: createdListingIds,
          },
        })
        .eq('id', batchId)
    } catch {
      /* ignore */
    }

    for (const id of createdListingIds) {
      try {
        await db.from('seasonal_prices').delete().eq('listing_id', id)
        await db.from('listings').delete().eq('id', id)
      } catch {
        /* ignore */
      }
    }

    return {
      ok: false,
      status: 500,
      code: 'INGEST_FAILED',
      error: err?.message || String(err),
      batchId,
    }
  }
}
