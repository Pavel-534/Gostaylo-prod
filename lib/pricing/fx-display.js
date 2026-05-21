/**
 * Stage 110.4 — SSOT отображения цены в валюте UI (сервер + реэкспорт client).
 *
 * Два независимых слоя (не смешивать):
 * 1. **guestServiceFeePercent** — сервисный сбор гостя в THB (`lib/pricing/guest-display-price.js`).
 * 2. **retailMarkup** (`chatInvoiceRateMultiplier`) — спред FX при конвертации THB → USD/RUB/…
 *    только для витрины; booking `pricing_snapshot` и settlement — mid (`retail=0`).
 *
 * Клиентские компоненты импортируют **`fx-display-client.js`**, не этот файл.
 *
 * @see lib/services/currency.service.js — источник курсов и множителя
 * @see lib/services/pricing/pricing-fx-helpers.js — checkout / settlement (без retail)
 */

import {
  getDisplayRateMap,
  resolveChatInvoiceRateMultiplier,
} from '@/lib/services/currency.service'

export {
  convertThbToDisplayCurrency,
  formatDisplayPriceInCurrency,
  displayPriceRawForTest,
  getListingGuestDisplayThb,
  getDisplayPriceInCurrency,
  computeWizardStorefrontPricePreview,
  roundAmountInCurrency,
  convertDisplayAmountToThb,
  convertThbToDisplayAmountRounded,
  computeUsdtFromThbRetail,
  getInvoiceGuestAmountPresentation,
  resolveInvoicePrefillFromStorefront,
} from '@/lib/pricing/fx-display-client'

/** @typedef {'storefront' | 'mid'} FxRetailMode */

/**
 * Парсинг query `retail` для GET /api/v2/exchange-rates.
 * @param {string | null | undefined} raw
 * @returns {boolean} true = витрина (по умолчанию)
 */
export function parseRetailFxQueryParam(raw) {
  if (raw == null || raw === '') return true
  const v = String(raw).trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  return true
}

/** @returns {FxRetailMode} */
export function retailModeFromApplyFlag(applyRetailMarkup) {
  return applyRetailMarkup === false ? 'mid' : 'storefront'
}

export async function resolveRetailMarkupMultiplier() {
  return resolveChatInvoiceRateMultiplier()
}

/** @deprecated alias */
export const resolveRetailFxMultiplier = resolveRetailMarkupMultiplier

export async function getStorefrontDisplayRateMap() {
  return getDisplayRateMap({ applyRetailMarkup: true })
}

export async function getMidMarketDisplayRateMap() {
  return getDisplayRateMap({ applyRetailMarkup: false })
}

export async function getDisplayRateMapForMode(applyRetailMarkup = true) {
  return getDisplayRateMap({ applyRetailMarkup })
}

/**
 * Stage 110.6 — серверный SSOT: сумма инвойса в валюте счёта → `amount_thb` / `amount_usdt` (retail = витрина).
 * @param {number} amount
 * @param {string} currency
 */
export async function settleInvoiceDisplayAmount(amount, currency) {
  const {
    convertDisplayAmountToThb: toThb,
    computeUsdtFromThbRetail: toUsdt,
  } = await import('@/lib/pricing/fx-display-client')
  const rateMap = await getStorefrontDisplayRateMap()
  const amountThb = toThb(amount, currency, rateMap)
  const amountUsdt = toUsdt(amountThb, rateMap)
  return { amountThb, amountUsdt, rateMap }
}
