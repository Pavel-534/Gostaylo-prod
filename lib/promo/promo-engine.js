import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

export function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase()
}

const APPLICABILITY_CACHE_TTL_MS = 45 * 1000
const APPLICABILITY_CACHE_MAX = 2500
const applicabilityCache = new Map()

function endOfDayUtcMs(dateLike) {
  const d = new Date(String(dateLike || ''))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return Date.UTC(y, m, day, 23, 59, 59, 999)
}

export function promoIsActiveAt(promo, atMs = Date.now()) {
  if (!promo || promo.is_active === false) {
    return { ok: false, reason: 'INACTIVE' }
  }
  if (promo.max_uses != null && Number(promo.current_uses) >= Number(promo.max_uses)) {
    return { ok: false, reason: 'USAGE_LIMIT_REACHED' }
  }
  if (promo.valid_until) {
    const endMs = new Date(promo.valid_until).getTime()
    if (!Number.isFinite(endMs) || endMs <= atMs) {
      return { ok: false, reason: 'EXPIRED' }
    }
  }
  return { ok: true }
}

/**
 * Unified promo applicability policy (Stage 36.0):
 * - core constraints: active, limits, time, partner-owner scope, allowlist scope
 * - contextual constraints: catalog conservative mode, optional stay-date coverage
 */
export function isCodeApplicable(promo, ctx = {}) {
  const atMs = Number.isFinite(Number(ctx.atMs)) ? Number(ctx.atMs) : Date.now()
  const active = promoIsActiveAt(promo, atMs)
  if (!active.ok) return active

  const listingId = ctx.listingId != null && ctx.listingId !== '' ? String(ctx.listingId).trim() : ''
  const listingOwnerId =
    ctx.listingOwnerId != null && ctx.listingOwnerId !== '' ? String(ctx.listingOwnerId).trim() : ''
  const mode = String(ctx.mode || 'booking').toLowerCase()
  const restrictPlatformGlobal = ctx.restrictPlatformGlobal === true

  const allowedIds = normalizeAllowedListingIdsFromRow(promo.allowed_listing_ids)
  if (allowedIds) {
    if (!listingId) return { ok: false, reason: 'LISTING_REQUIRED_FOR_ALLOWLIST' }
    if (!allowedIds.includes(listingId)) return { ok: false, reason: 'LISTING_NOT_ALLOWED' }
  }

  const ownerType = String(promo.created_by_type || 'PLATFORM').toUpperCase()
  if (ownerType === 'PARTNER') {
    const partnerId = promo.partner_id ? String(promo.partner_id).trim() : ''
    if (!partnerId) return { ok: false, reason: 'PARTNER_SCOPE_INVALID' }
    if (!listingOwnerId) return { ok: false, reason: 'LISTING_OWNER_REQUIRED' }
    if (listingOwnerId !== partnerId) return { ok: false, reason: 'LISTING_OWNER_MISMATCH' }
  } else if (mode === 'catalog' && restrictPlatformGlobal && !allowedIds?.length) {
    return { ok: false, reason: 'PLATFORM_GLOBAL_HIDDEN_IN_CATALOG' }
  }

  if (ctx.requireTargetDateCoverage && ctx.targetDate && promo.valid_until) {
    const targetEndMs = endOfDayUtcMs(ctx.targetDate)
    const promoEndMs = new Date(promo.valid_until).getTime()
    if (targetEndMs != null && Number.isFinite(promoEndMs) && promoEndMs < targetEndMs) {
      return { ok: false, reason: 'TARGET_DATE_OUTSIDE_PROMO' }
    }
  }

  return { ok: true }
}

function buildApplicabilityCacheKey(promo, ctx) {
  const atMs = Number.isFinite(Number(ctx?.atMs)) ? Number(ctx.atMs) : Date.now()
  const timeBucket = Math.floor(atMs / APPLICABILITY_CACHE_TTL_MS)
  return [
    String(promo?.id || promo?.code || ''),
    String(promo?.valid_until || ''),
    String(promo?.max_uses ?? ''),
    String(promo?.current_uses ?? ''),
    String(promo?.is_active ?? ''),
    String(ctx?.mode || 'booking'),
    String(ctx?.listingId || ''),
    String(ctx?.listingOwnerId || ''),
    String(ctx?.targetDate || ''),
    String(ctx?.requireTargetDateCoverage === true),
    String(ctx?.restrictPlatformGlobal === true),
    String(timeBucket),
  ].join('|')
}

function cleanupApplicabilityCache(nowMs) {
  if (applicabilityCache.size <= APPLICABILITY_CACHE_MAX) return
  for (const [k, v] of applicabilityCache.entries()) {
    if (!v || v.expiresAt <= nowMs) applicabilityCache.delete(k)
  }
  if (applicabilityCache.size <= APPLICABILITY_CACHE_MAX) return
  const overflow = applicabilityCache.size - APPLICABILITY_CACHE_MAX
  let dropped = 0
  for (const k of applicabilityCache.keys()) {
    applicabilityCache.delete(k)
    dropped += 1
    if (dropped >= overflow) break
  }
}

/**
 * In-memory memo (TTL ~45s) for hot applicability loops — safe on server and in client bundles.
 * Do not use `react` `cache()` here: this module is imported via {@link import('@/lib/services/pricing.service').PricingService} on the client.
 */
export function checkApplicabilityCached(promo, ctx = {}) {
  const nowMs = Date.now()
  const key = buildApplicabilityCacheKey(promo, ctx)
  const hit = applicabilityCache.get(key)
  if (hit && hit.expiresAt > nowMs) return hit.result

  const result = isCodeApplicable(promo, ctx)
  applicabilityCache.set(key, {
    result,
    expiresAt: nowMs + APPLICABILITY_CACHE_TTL_MS,
  })
  cleanupApplicabilityCache(nowMs)
  return result
}

export function calculatePromoDiscountAmount(promo, amountThb) {
  const amount = Math.max(0, Math.round(Number(amountThb) || 0))
  if (amount <= 0 || !promo) return 0
  const type = String(promo.promo_type || '').toUpperCase()
  const value = Number(promo.value)
  if (!Number.isFinite(value) || value <= 0) return 0

  let discount = 0
  if (type === 'PERCENTAGE') {
    discount = Math.round((amount * Math.min(100, value)) / 100)
  } else {
    discount = Math.round(value)
  }
  return Math.min(amount, Math.max(0, discount))
}
