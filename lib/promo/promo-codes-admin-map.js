/**
 * Admin marketing UI ↔ таблица `promo_codes` ↔ {@link import('@/lib/services/pricing.service').PricingService.validatePromoCode}.
 * Канон типов в БД: `PERCENTAGE` | `FIXED` (enum `promo_type`).
 */

/** @param {string} uiType */
export function promoTypeUiToDb(uiType) {
  const t = String(uiType || '').toUpperCase()
  if (t === 'PERCENT' || t === 'PERCENTAGE') return 'PERCENTAGE'
  return 'FIXED'
}

/** @param {string} dbType */
export function promoTypeDbToUi(dbType) {
  const t = String(dbType || '').toUpperCase()
  return t === 'PERCENTAGE' ? 'PERCENT' : 'FIXED'
}

/**
 * @param {object} row — Supabase `promo_codes` row
 */
export function mapPromoRowToAdminDto(row) {
  if (!row) return null
  let expiryDate = ''
  if (row.valid_until) {
    const d = new Date(row.valid_until)
    if (!Number.isNaN(d.getTime())) expiryDate = d.toISOString().slice(0, 10)
  }
  return {
    id: row.id,
    code: row.code,
    type: promoTypeDbToUi(row.promo_type),
    promo_type: row.promo_type,
    value: Number(row.value),
    expiryDate,
    /** `null` = без лимита (как в {@link import('@/lib/services/pricing.service').PricingService.validatePromoCode}) */
    usageLimit: row.max_uses != null ? Number(row.max_uses) : null,
    usedCount: Number(row.current_uses) || 0,
    isActive: row.is_active !== false,
    minAmount: row.min_amount != null ? Number(row.min_amount) : 0,
    createdByType: String(row.created_by_type || 'PLATFORM').toUpperCase(),
    partnerId: row.partner_id || null,
  }
}

/**
 * @param {object} body — тело из `app/admin/marketing/page.js`
 * @returns {object} insert payload для `promo_codes`
 */
export function buildPromoInsertFromAdminBody(body) {
  const code = String(body?.code || '').trim().toUpperCase()
  const promo_type = promoTypeUiToDb(body?.type)
  const value = parseFloat(body?.value)
  const max_uses = Math.max(1, parseInt(String(body?.usageLimit ?? ''), 10) || 0)
  const expiryRaw = String(body?.expiryDate || '').trim()

  if (!code) {
    const e = new Error('Code is required')
    e.code = 'VALIDATION'
    throw e
  }
  if (!Number.isFinite(value) || value <= 0) {
    const e = new Error('Value must be a positive number')
    e.code = 'VALIDATION'
    throw e
  }
  if (!expiryRaw) {
    const e = new Error('Expiry date is required')
    e.code = 'VALIDATION'
    throw e
  }
  if (promo_type === 'PERCENTAGE' && value > 100) {
    const e = new Error('Percentage cannot exceed 100')
    e.code = 'VALIDATION'
    throw e
  }

  const valid_until = new Date(`${expiryRaw}T23:59:59.999Z`).toISOString()

  return {
    code,
    promo_type,
    value,
    max_uses,
    current_uses: 0,
    min_amount: 0,
    is_active: true,
    valid_until,
    created_by_type: 'PLATFORM',
    partner_id: null,
  }
}
