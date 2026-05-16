/**
 * Map FinalBreakdown → pricing_snapshot v2 (immutable booking JSON).
 */

import {
  getFiscalTransitSupplierInfo,
  getFiscalRuPlatformInfo,
  isFiscalSandboxEnabled,
} from './fiscal-config.js'

/** FFD 1.2: признак способа расчёта «полный расчёт» */
const FFD_PAYMENT_METHOD_FULL = 4

/** Keys never exposed to partner/guest APIs */
const INTERNAL_SNAPSHOT_KEYS = new Set([
  'platform_margin_pool_thb',
  'ru_fee_thb',
  'kr_fee_thb',
  'ru_agent_share_thb',
  'kr_agent_share_thb',
  'fx_markup_thb',
  'rounding_pot_thb',
  'rounding_diff_pot_thb',
  'fx_raw_rate_to_thb',
  'fx_customer_rate_to_thb',
  'fx_markup_pct_applied',
  'insurance_reserve_thb',
])

/**
 * @param {import('./types').FinalBreakdown} breakdown
 * @param {object} [priceCalc]
 * @param {number} [listingBasePriceThb]
 */
export function toPricingSnapshotV2(breakdown, priceCalc = null, listingBasePriceThb = 0) {
  const b = breakdown || {}
  const potThb = b.rounding_pot_thb ?? b.rounding_diff_pot_thb ?? 0

  const snap = {
    v: 2,
    computed_at: new Date().toISOString(),
    pricing_profile_id: b.pricing_profile_id || null,
    resolution_trace: Array.isArray(b.resolution_trace) ? b.resolution_trace : [],
    final_breakdown: {
      subtotal_thb: b.subtotal_thb,
      guest_service_fee_thb: b.guest_service_fee_thb,
      host_commission_thb: b.host_commission_thb,
      tax_amount_thb: b.tax_amount_thb,
      insurance_reserve_thb: b.insurance_reserve_thb,
      platform_margin_pool_thb: b.platform_margin_pool_thb,
      ru_fee_thb: b.ru_fee_thb,
      kr_fee_thb: b.kr_fee_thb,
      fx_markup_thb: b.fx_markup_thb,
      total_guest_payable_thb: b.total_guest_payable_thb,
      total_guest_payable_rounded_thb: b.total_guest_payable_rounded_thb,
      rounding_pot_thb: potThb,
      rounding_diff_pot_thb: potThb,
      total_partner_netto_thb: b.total_partner_netto_thb,
      total_guest_brutto: b.total_guest_brutto || null,
      fx_raw_rate_to_thb: b.fx_raw_rate_to_thb ?? null,
      fx_customer_rate_to_thb: b.fx_customer_rate_to_thb ?? null,
      fx_markup_pct_applied: b.fx_markup_pct_applied ?? null,
    },
    fee_split_v2: {
      immutable: true,
      guest_service_fee_thb: b.guest_service_fee_thb,
      host_commission_thb: b.host_commission_thb,
      platform_gross_revenue_thb: (b.guest_service_fee_thb || 0) + (b.host_commission_thb || 0),
      insurance_reserve_thb: b.insurance_reserve_thb,
      ru_fee_thb: b.ru_fee_thb,
      kr_fee_thb: b.kr_fee_thb,
      fx_markup_thb: b.fx_markup_thb,
      guest_payable_thb: b.total_guest_payable_thb,
      guest_payable_rounded_thb: b.total_guest_payable_rounded_thb,
      rounding_pot_thb: potThb,
      rounding_diff_pot_thb: potThb,
    },
  }

  if (priceCalc && !priceCalc.error) {
    snap.nights = priceCalc.nights ?? 0
    snap.listing_base_price_thb = Number(listingBasePriceThb) || 0
    snap.subtotal_before_duration_discount_thb = priceCalc.originalPrice ?? b.subtotal_thb
    snap.accommodation_total_after_duration_thb = priceCalc.totalPrice ?? b.subtotal_thb
    if (priceCalc.durationDiscountAmount) {
      snap.duration_discount = {
        percent: priceCalc.durationDiscountPercent ?? 0,
        amount_thb: priceCalc.durationDiscountAmount,
        min_nights_threshold: priceCalc.durationDiscountMinNights ?? null,
        source_key: priceCalc.durationDiscountSourceKey ?? null,
      }
    }
  }

  return snap
}

/**
 * Partner/guest-safe projection — **only** Brutto + Netto (no internal split, no pot, no FX).
 * @param {import('./types').FinalBreakdown} breakdown
 */
export function toPartnerVisibleBreakdown(breakdown) {
  if (!breakdown) return null

  const brutto = breakdown.total_guest_brutto
  const currency =
    brutto && typeof brutto === 'object' && brutto.currency
      ? String(brutto.currency).toUpperCase()
      : 'THB'

  return {
    total_partner_netto_thb: Math.round(Number(breakdown.total_partner_netto_thb) || 0),
    total_guest_payable_rounded_thb: Math.round(Number(breakdown.total_guest_payable_rounded_thb) || 0),
    total_guest_brutto:
      brutto && typeof brutto === 'object'
        ? {
            amount: Number(brutto.amount),
            currency,
          }
        : {
            amount: Math.round(Number(breakdown.total_guest_payable_rounded_thb) || 0),
            currency: 'THB',
          },
    currency,
  }
}

/**
 * 54-FZ — один чек «Полный расчёт» в момент оплаты (Stage 97.0.6).
 * Transit: agent_sign=5, supplier_info.name = KG ОсОО, supplier_info.inn = ИНН РФ.
 * KG IT fee — не роялти (отдельная позиция, ledger PLATFORM_FEE_KG_SERVICE).
 *
 * @param {import('./types').FinalBreakdown} breakdown
 * @param {object} [options]
 */
export function toFiscalKassaPayload(breakdown, options = {}) {
  if (!breakdown) return null

  const transitSupplier = {
    ...getFiscalTransitSupplierInfo(),
    ...(options.transit_supplier && typeof options.transit_supplier === 'object'
      ? options.transit_supplier
      : {}),
  }
  const ruPlatform = getFiscalRuPlatformInfo()
  const roundThb = (n) => Math.round(Number(n) || 0)
  const items = []

  const lineBase = {
    quantity: 1,
    measure: 'piece',
    payment_method: FFD_PAYMENT_METHOD_FULL,
    payment_method_label: 'full_payment',
    payment_object: 'service',
  }

  const transitThb = roundThb(breakdown.total_partner_netto_thb)
  if (transitThb > 0) {
    items.push({
      ...lineBase,
      name: options.transitItemName || 'Услуга принципала (транзит)',
      price: transitThb,
      sum: transitThb,
      agent_sign: 5,
      supplier_info: transitSupplier,
    })
  }

  const ruThb = roundThb(breakdown.ru_fee_thb)
  if (ruThb > 0) {
    items.push({
      ...lineBase,
      name: 'Агентское вознаграждение платформы (РФ)',
      price: ruThb,
      sum: ruThb,
      agent_sign: null,
      supplier_info: ruPlatform.inn ? { name: ruPlatform.name, inn: ruPlatform.inn } : null,
    })
  }

  const krThb = roundThb(breakdown.kr_fee_thb)
  if (krThb > 0) {
    items.push({
      ...lineBase,
      name: 'Оплата за ИТ-услуги и техническую поддержку платформы',
      price: krThb,
      sum: krThb,
      agent_sign: null,
      supplier_info: {
        name: transitSupplier.name,
        inn: transitSupplier.inn || undefined,
      },
    })
  }

  const fxThb = roundThb(breakdown.fx_markup_thb)
  if (fxThb > 0) {
    items.push({
      ...lineBase,
      name: 'Комиссия за конвертацию валюты',
      price: fxThb,
      sum: fxThb,
      agent_sign: null,
    })
  }

  const taxThb = roundThb(breakdown.tax_amount_thb)
  if (taxThb > 0) {
    items.push({
      ...lineBase,
      name: 'Налог',
      price: taxThb,
      sum: taxThb,
      agent_sign: null,
    })
  }

  const potThb = roundThb(breakdown.rounding_pot_thb ?? breakdown.rounding_diff_pot_thb)
  if (potThb !== 0) {
    items.push({
      ...lineBase,
      name: 'Корректировка округления',
      price: potThb,
      sum: potThb,
      agent_sign: null,
    })
  }

  const receiptTotal = roundThb(breakdown.total_guest_payable_rounded_thb)
  const itemsSum = items.reduce((s, it) => s + roundThb(it.sum), 0)
  const drift = roundThb(receiptTotal - itemsSum)
  if (Math.abs(drift) > 0 && items.length > 0) {
    items[items.length - 1].sum = roundThb(items[items.length - 1].sum + drift)
    items[items.length - 1].price = items[items.length - 1].sum
  }

  const sandbox = isFiscalSandboxEnabled()

  return {
    schema: 'fiscal_kassa_v2',
    locale: options.locale || 'ru',
    receipt: {
      type: 'sell',
      payment_method: FFD_PAYMENT_METHOD_FULL,
      payment_method_label: 'Полный расчёт',
      one_receipt: true,
      items,
      payments: [
        {
          type: options.payment_type || 'electronically',
          sum: receiptTotal,
        },
      ],
      total: receiptTotal,
    },
    supplier_info_transit: transitSupplier,
    totals: {
      guest_payable_rounded_thb: receiptTotal,
      guest_brutto: breakdown.total_guest_brutto || null,
      items_sum_thb: items.reduce((s, it) => s + roundThb(it.sum), 0),
    },
    meta: {
      pricing_profile_id: breakdown.pricing_profile_id || null,
      kg_service_ledger_account: 'PLATFORM_FEE_KG_SERVICE',
      kg_service_legal_note:
        'Оплата за ИТ-услуги и техническую поддержку платформы (не роялти)',
      fiscal_sandbox: sandbox,
      pending_status_on_failure: 'PENDING_FISCAL',
    },
    ...(sandbox
      ? {
          sandbox_receipt: {
            mock: true,
            receipt_id: `sandbox-${Date.now()}`,
            message: 'FISCAL_SANDBOX=true — чек-муляж',
          },
        }
      : {}),
  }
}

/**
 * Strip internal keys from a snapshot object (defense in depth for accidental API leaks).
 * @param {object} snapshot
 */

export function stripInternalFromPricingSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot
  const out = { ...snapshot }
  if (out.final_breakdown && typeof out.final_breakdown === 'object') {
    const fb = { ...out.final_breakdown }
    for (const key of INTERNAL_SNAPSHOT_KEYS) {
      delete fb[key]
    }
    out.final_breakdown = fb
  }
  return out
}
