/**
 * Stage 104 — SSOT идентификаторов рельсов выплат (ADR-097).
 *
 * TBANK_RU  — RUB Direct (партнёры РФ, банковский реестр T-Bank).
 * KG_CRYPTO — International / KG·USDT (Таиланд и зарубежье, крипто/KG).
 */

export const PAYOUT_RAIL = Object.freeze({
  RUB_DIRECT: 'TBANK_RU',
  INTERNATIONAL: 'KG_CRYPTO',
})

/** @typedef {'TBANK_RU' | 'KG_CRYPTO'} PayoutRailId */

export const PAYOUT_RAIL_META = Object.freeze({
  TBANK_RU: {
    id: 'TBANK_RU',
    ownerLabel: 'RUB Direct',
    ownerShort: 'RU Direct',
    description: 'Прямой перевод в банк РФ (T-Bank CSV)',
    partnerCurrencies: ['RUB'],
    payoutMethodHint: 'pm-bank-ru',
    registryFileBase: 'registry-rub-direct',
  },
  KG_CRYPTO: {
    id: 'KG_CRYPTO',
    ownerLabel: 'KG / USDT',
    ownerShort: 'International',
    description: 'Международный рельс: USDT / ОсОО KG (до подключения биржи — симуляция)',
    partnerCurrencies: ['USDT', 'USD', 'THB'],
    payoutMethodHint: 'pm-crypto-usdt',
    registryFileBase: 'registry-kg-usdt',
  },
})

const ALIASES = Object.freeze({
  RUB: 'TBANK_RU',
  RU: 'TBANK_RU',
  RUB_DIRECT: 'TBANK_RU',
  TBANK: 'TBANK_RU',
  TBANK_RU: 'TBANK_RU',
  INTL: 'KG_CRYPTO',
  INTERNATIONAL: 'KG_CRYPTO',
  KG: 'KG_CRYPTO',
  USDT: 'KG_CRYPTO',
  KG_CRYPTO: 'KG_CRYPTO',
  KG_USDT: 'KG_CRYPTO',
})

/**
 * @param {string | null | undefined} input
 * @returns {PayoutRailId}
 */
export function normalizePayoutRail(input) {
  const key = String(input || PAYOUT_RAIL.RUB_DIRECT)
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
  return ALIASES[key] || PAYOUT_RAIL.RUB_DIRECT
}

/**
 * @param {string | null | undefined} railId
 */
export function getPayoutRailMeta(railId) {
  const id = normalizePayoutRail(railId)
  return PAYOUT_RAIL_META[id] || PAYOUT_RAIL_META.TBANK_RU
}

/**
 * @param {string | null | undefined} preferredPayoutCurrency — profiles.preferred_payout_currency
 * @returns {PayoutRailId}
 */
export function resolvePayoutRailForPartnerCurrency(preferredPayoutCurrency) {
  const c = String(preferredPayoutCurrency || 'THB')
    .trim()
    .toUpperCase()
  if (c === 'RUB') return PAYOUT_RAIL.RUB_DIRECT
  return PAYOUT_RAIL.INTERNATIONAL
}

/**
 * @param {PayoutRailId} railId
 * @param {string | null | undefined} preferredPayoutCurrency
 */
export function partnerCurrencyMatchesRail(railId, preferredPayoutCurrency) {
  const rail = normalizePayoutRail(railId)
  const meta = getPayoutRailMeta(rail)
  const c = String(preferredPayoutCurrency || 'THB').toUpperCase()
  return meta.partnerCurrencies.includes(c)
}

/**
 * @param {PayoutRailId} railId
 */
export function defaultPartnerPayoutCurrencyForRail(railId) {
  const rail = normalizePayoutRail(railId)
  return rail === PAYOUT_RAIL.RUB_DIRECT ? 'RUB' : 'USDT'
}

export const PAYOUT_RAIL_OPTIONS = Object.values(PAYOUT_RAIL_META)
