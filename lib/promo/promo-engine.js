import { cache } from 'react'
import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

export function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase()
}

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
function isCodeApplicableImpl(promo, ctx = {}) {
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

const runIsCodeApplicableCached = cache((serialized) => {
  const { promo, ctx } = JSON.parse(serialized)
  return isCodeApplicableImpl(promo, ctx)
})

/**
 * Request-scoped memoization via `react` `cache` (Stage 38.0): repeated (promo, ctx) in one request
 * (e.g. catalog grid) reuse the same applicability result.
 */
export function isCodeApplicable(promo, ctx = {}) {
  const atMs = Number.isFinite(Number(ctx?.atMs)) ? Number(ctx.atMs) : Date.now()
  const ctxNorm = { ...ctx, atMs }
  return runIsCodeApplicableCached(
    JSON.stringify({ promo, ctx: ctxNorm }),
  )
}

/** @deprecated Alias for {@link isCodeApplicable}; TTL cache removed in Stage 38.0. */
export function checkApplicabilityCached(promo, ctx = {}) {
  return isCodeApplicable(promo, ctx)
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
