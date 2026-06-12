/**
 * Stage 104 — SSOT идентификаторов рельсов выплат (ADR-097).
 *
 * TBANK_RU           — RUB Direct (партнёры РФ, банковский реестр T-Bank).
 * KG_CRYPTO          — International / KG·USDT (Таиланд и зарубежье, крипто/KG).
 * REFERRAL_RUB_CARD  — Stage 131.6: вывод реферальных бонусов амбассадоров (RUB, T-Bank).
 * REFERRAL_KGS_ELKART — Stage 131.8 stub: KG Elkart (KGS, pm-bank-kgs).
 * REFERRAL_UZS_UZCARD — Stage 131.8 stub: UZ Uzcard (UZS, pm-bank-uzs).
 */

export const PAYOUT_RAIL = Object.freeze({
  RUB_DIRECT: 'TBANK_RU',
  INTERNATIONAL: 'KG_CRYPTO',
  REFERRAL_RUB_CARD: 'REFERRAL_RUB_CARD',
  REFERRAL_KGS_ELKART: 'REFERRAL_KGS_ELKART',
  REFERRAL_UZS_UZCARD: 'REFERRAL_UZS_UZCARD',
})

/** @typedef {'TBANK_RU' | 'KG_CRYPTO' | 'REFERRAL_RUB_CARD' | 'REFERRAL_KGS_ELKART' | 'REFERRAL_UZS_UZCARD'} PayoutRailId */

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
  REFERRAL_RUB_CARD: {
    id: 'REFERRAL_RUB_CARD',
    ownerLabel: 'Referral RUB Card',
    ownerShort: 'Referral RU',
    description: 'Вывод реферальных бонусов амбассадоров на карту/счёт РФ (T-Bank CSV)',
    partnerCurrencies: ['RUB'],
    payoutMethodHint: 'pm-bank-ru',
    registryFileBase: 'registry-referral-rub',
  },
  REFERRAL_KGS_ELKART: {
    id: 'REFERRAL_KGS_ELKART',
    ownerLabel: 'Referral KG Elkart',
    ownerShort: 'Referral KG',
    description: 'Stage 131.8 stub — вывод реферальных бонусов на Elkart (KGS)',
    partnerCurrencies: ['KGS'],
    payoutMethodHint: 'pm-bank-kgs',
    registryFileBase: 'registry-referral-kgs-elkart',
    implementationStatus: 'stub',
  },
  REFERRAL_UZS_UZCARD: {
    id: 'REFERRAL_UZS_UZCARD',
    ownerLabel: 'Referral UZ Uzcard',
    ownerShort: 'Referral UZ',
    description: 'Stage 131.8 stub — вывод реферальных бонусов на Uzcard (UZS)',
    partnerCurrencies: ['UZS'],
    payoutMethodHint: 'pm-bank-uzs',
    registryFileBase: 'registry-referral-uzs-uzcard',
    implementationStatus: 'stub',
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
  REFERRAL_RUB_CARD: 'REFERRAL_RUB_CARD',
  REFERRAL: 'REFERRAL_RUB_CARD',
  REFERRAL_RU: 'REFERRAL_RUB_CARD',
  REFERRAL_KGS_ELKART: 'REFERRAL_KGS_ELKART',
  REFERRAL_KG: 'REFERRAL_KGS_ELKART',
  ELKART: 'REFERRAL_KGS_ELKART',
  KGS_ELKART: 'REFERRAL_KGS_ELKART',
  REFERRAL_UZS_UZCARD: 'REFERRAL_UZS_UZCARD',
  REFERRAL_UZ: 'REFERRAL_UZS_UZCARD',
  UZCARD: 'REFERRAL_UZS_UZCARD',
  UZS_UZCARD: 'REFERRAL_UZS_UZCARD',
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
  if (key === PAYOUT_RAIL.REFERRAL_RUB_CARD) return PAYOUT_RAIL.REFERRAL_RUB_CARD
  if (key === PAYOUT_RAIL.REFERRAL_KGS_ELKART) return PAYOUT_RAIL.REFERRAL_KGS_ELKART
  if (key === PAYOUT_RAIL.REFERRAL_UZS_UZCARD) return PAYOUT_RAIL.REFERRAL_UZS_UZCARD
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
