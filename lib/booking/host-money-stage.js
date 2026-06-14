/**
 * Stage 140.2 — SSOT "денежного пути" хоста (Host Money Timeline).
 *
 * Единственный источник понятных хосту объяснений «где мои деньги»: заголовок,
 * ETA-подсказка и цвет статуса. Никакого бэкенд-жаргона в UI
 * (`THAWED`, `PAID_ESCROW`, `escrow`, `ledger` наружу не протекают).
 *
 * Сырые статусы брони — `lib/booking/status-transitions.js`
 * (CHECKED_IN ≠ THAWED). UI-резолв — `lib/booking/booking-status-display.js`
 * (`resolveBookingUiStatus`). i18n-ключи `hostMoney_*` — `slices/partner-ui.js`.
 */

import { getUIText } from '@/lib/translations'

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

/**
 * Метаданные этапа: i18n-ключи заголовка/ETA + цветовые токены.
 * `tone` — семантический ключ, `dotClass` / `chipClass` — токены дизайн-системы.
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
    etaKey: 'hostMoney_protectedEta',
    tone: 'brand',
    dotClass: 'bg-brand',
    chipClass: 'bg-brand/10 text-brand border-brand/25',
  },
  [HOST_MONEY_STAGE.RELEASING]: {
    titleKey: 'hostMoney_releasingTitle',
    etaKey: 'hostMoney_releasingEta',
    tone: 'sky',
    dotClass: 'bg-sky-500',
    chipClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  [HOST_MONEY_STAGE.READY]: {
    titleKey: 'hostMoney_readyTitle',
    etaKey: 'hostMoney_readyEta',
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
 * @param {string} status — DB или UI статус брони
 * @returns {string} один из {@link HOST_MONEY_STAGE}
 */
export function getHostMoneyStageKey(status) {
  const key = String(status || '').toUpperCase()
  return STATUS_TO_STAGE[key] || HOST_MONEY_STAGE.NONE
}

/**
 * Понятное хосту объяснение «где деньги»: заголовок + ETA + цвет.
 * Возвращает `null` для статусов без денежного смысла (PENDING / INQUIRY).
 *
 * @param {string} status — DB или UI статус брони
 * @param {'ru'|'en'|'zh'|'th'|string} [language]
 * @returns {{ stage: string, title: string, eta: string, tone: string, dotClass: string, chipClass: string } | null}
 */
export function getHostMoneyStage(status, language = 'ru') {
  const stage = getHostMoneyStageKey(status)
  const meta = STAGE_META[stage]
  if (!meta) return null
  return {
    stage,
    title: getUIText(meta.titleKey, language),
    eta: getUIText(meta.etaKey, language),
    tone: meta.tone,
    dotClass: meta.dotClass,
    chipClass: meta.chipClass,
  }
}
