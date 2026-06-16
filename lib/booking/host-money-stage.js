/**
 * Stage 140.2 / 149 — SSOT "денежного пути" хоста (Host Money Timeline).
 *
 * ETA copy — `lib/booking/payout-release-config.js` (vertical-aware thaw + 24h hold).
 * Сырые статусы — `lib/booking/status-transitions.js` (CHECKED_IN ≠ THAWED).
 */

import { getUIText } from '@/lib/translations'
import {
  getPayoutReleaseConfig,
  getPayoutReleaseDisplayText,
  getPayoutReleaseUiTexts,
} from '@/lib/booking/payout-release-config.js'

/** Этапы денежного пути (UI-агрегат поверх статусов брони). */
export const HOST_MONEY_STAGE = Object.freeze({
  AWAITING_PAYMENT: 'awaiting_payment',
  PROTECTED: 'protected',
  RELEASING: 'releasing',
  READY: 'ready',
  PAID_OUT: 'paid_out',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
  NONE: 'none',
})

/** Статус брони (DB или UI) → этап денежного пути. */
const STATUS_TO_STAGE = Object.freeze({
  PENDING: HOST_MONEY_STAGE.NONE,
  INQUIRY: HOST_MONEY_STAGE.NONE,
  CONFIRMED: HOST_MONEY_STAGE.AWAITING_PAYMENT,
  AWAITING_PAYMENT: HOST_MONEY_STAGE.AWAITING_PAYMENT,
  PAID: HOST_MONEY_STAGE.PROTECTED,
  PAID_ESCROW: HOST_MONEY_STAGE.PROTECTED,
  CHECKED_IN: HOST_MONEY_STAGE.PROTECTED,
  DISPUTED: HOST_MONEY_STAGE.DISPUTED,
  THAWED: HOST_MONEY_STAGE.RELEASING,
  THAW_HOLD: HOST_MONEY_STAGE.RELEASING,
  READY_FOR_PAYOUT: HOST_MONEY_STAGE.READY,
  COMPLETED: HOST_MONEY_STAGE.PAID_OUT,
  CANCELLED: HOST_MONEY_STAGE.REFUNDED,
  REFUNDED: HOST_MONEY_STAGE.REFUNDED,
})

const STAGE_ETA_VARIANT = Object.freeze({
  [HOST_MONEY_STAGE.AWAITING_PAYMENT]: null,
  [HOST_MONEY_STAGE.PROTECTED]: 'protected',
  [HOST_MONEY_STAGE.RELEASING]: 'releasing',
  [HOST_MONEY_STAGE.READY]: 'ready',
  [HOST_MONEY_STAGE.PAID_OUT]: null,
  [HOST_MONEY_STAGE.DISPUTED]: null,
  [HOST_MONEY_STAGE.REFUNDED]: null,
})

/**
 * Метаданные этапа: i18n-ключи заголовка + цветовые токены.
 */
const STAGE_META = Object.freeze({
  [HOST_MONEY_STAGE.AWAITING_PAYMENT]: {
    titleKey: 'hostMoney_awaitingTitle',
    etaKey: 'hostMoney_awaitingEta',
    tone: 'amber',
    dotClass: 'bg-amber-400',
    chipClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  [HOST_MONEY_STAGE.PROTECTED]: {
    titleKey: 'hostMoney_protectedTitle',
    tone: 'brand',
    dotClass: 'bg-brand',
    chipClass: 'bg-brand/10 text-brand border-brand/25',
  },
  [HOST_MONEY_STAGE.RELEASING]: {
    titleKey: 'hostMoney_releasingTitle',
    tone: 'sky',
    dotClass: 'bg-sky-500',
    chipClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  [HOST_MONEY_STAGE.READY]: {
    titleKey: 'hostMoney_readyTitle',
    tone: 'indigo',
    dotClass: 'bg-indigo-500',
    chipClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  },
  [HOST_MONEY_STAGE.PAID_OUT]: {
    titleKey: 'hostMoney_paidTitle',
    etaKey: 'hostMoney_paidEta',
    tone: 'emerald',
    dotClass: 'bg-emerald-500',
    chipClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  [HOST_MONEY_STAGE.DISPUTED]: {
    titleKey: 'hostMoney_disputedTitle',
    etaKey: 'hostMoney_disputedEta',
    tone: 'rose',
    dotClass: 'bg-rose-500',
    chipClass: 'bg-rose-50 text-rose-900 border-rose-200',
  },
  [HOST_MONEY_STAGE.REFUNDED]: {
    titleKey: 'hostMoney_refundedTitle',
    etaKey: 'hostMoney_refundedEta',
    tone: 'slate',
    dotClass: 'bg-slate-400',
    chipClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
})

/**
 * @param {string} status
 * @returns {string}
 */
export function getHostMoneyStageKey(status) {
  const key = String(status || '').toUpperCase()
  return STATUS_TO_STAGE[key] || HOST_MONEY_STAGE.NONE
}

/**
 * Listing-level payout policy (wizard / finances overview without a booking).
 * @param {{ categorySlug?: string, wizardProfile?: string | null }} listingContext
 * @param {'ru'|'en'|'zh'|'th'|string} [language]
 */
export function getHostMoneyPolicyForListing(listingContext, language = 'ru') {
  const config = getPayoutReleaseConfig(listingContext || {})
  return getPayoutReleaseUiTexts(config, language)
}

/**
 * @param {string} status — DB или UI статус брони
 * @param {'ru'|'en'|'zh'|'th'|string} [language]
 * @param {object | null} [bookingOrListingContext] — booking row или { categorySlug, wizardProfile }
 * @returns {{ stage: string, title: string, eta: string, tone: string, dotClass: string, chipClass: string } | null}
 */
export function getHostMoneyStage(status, language = 'ru', bookingOrListingContext = null) {
  const stage = getHostMoneyStageKey(status)
  const meta = STAGE_META[stage]
  if (!meta) return null

  const etaVariant = STAGE_ETA_VARIANT[stage]
  let eta
  if (etaVariant && bookingOrListingContext) {
    const config = getPayoutReleaseConfig(bookingOrListingContext)
    eta = getPayoutReleaseDisplayText(config, language, etaVariant)
  } else if (etaVariant) {
    const config = getPayoutReleaseConfig({ categorySlug: 'property' })
    eta = getPayoutReleaseDisplayText(config, language, etaVariant)
  } else if (meta.etaKey) {
    eta = getUIText(meta.etaKey, language)
  } else {
    eta = ''
  }

  return {
    stage,
    title: getUIText(meta.titleKey, language),
    eta,
    tone: meta.tone,
    dotClass: meta.dotClass,
    chipClass: meta.chipClass,
  }
}
