/**
 * Stage 132.0 / 132.2 — SSOT: payout blocker codes → i18n keys + RU fallback.
 */

/**
 * @param {string[]} blockers
 * @param {{ minPayoutThb?: number }} [ctx]
 * @returns {Array<{ code: string, messageKey?: string, actionLabelKey?: string, messageRu: string, actionHref: string, actionLabel: string, messageCtx?: object }>}
 */
export function buildPayoutBlockerDetails(blockers, ctx = {}) {
  const minThb = Number.isFinite(Number(ctx.minPayoutThb)) ? Number(ctx.minPayoutThb) : 1000
  const messageCtx = { minPayoutThb: minThb }

  /** @type {Record<string, Omit<ReturnType<typeof buildPayoutBlockerDetails>[0], 'code'>>} */
  const catalog = {
    BELOW_MIN_PAYOUT: {
      messageKey: 'stage1322_blockerBelowMin',
      actionLabelKey: 'stage1322_blockerBelowMinAction',
      messageRu: 'Минимальная сумма для вывода ещё не набрана. Дождитесь накопления баланса или пригласите друзей.',
      actionHref: '/profile/referral',
      actionLabel: 'Пригласить друзей',
      messageCtx,
    },
    PROFILE_NOT_VERIFIED: {
      messageKey: 'stage1322_blockerProfileNotVerified',
      actionLabelKey: 'stage1322_blockerProfileNotVerifiedAction',
      messageRu: 'Для вывода нужна верификация профиля (KYC). Обычно это занимает 1–2 рабочих дня.',
      actionHref: '/profile',
      actionLabel: 'Открыть профиль',
    },
    WALLET_NOT_CLEARED_FOR_PAYOUT: {
      messageKey: 'stage1322_blockerWalletNotCleared',
      actionLabelKey: 'stage1322_blockerWalletNotClearedAction',
      messageRu: 'Вывод временно закрыт: требуется допуск оператора («Доступен вывод»).',
      actionHref: '/help/escrow-protection',
      actionLabel: 'Как это работает',
    },
    REFERRAL_RU_PAYOUT_PROFILE_REQUIRED: {
      messageKey: 'stage1322_blockerRuProfileRequired',
      actionLabelKey: 'stage1322_blockerRuProfileRequiredAction',
      messageRu: 'Укажите реквизиты карты или счёта в банке РФ — без них выплата в рублях невозможна.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Заполнить реквизиты',
    },
    REFERRAL_RU_PAYOUT_PROFILE_INCOMPLETE: {
      messageKey: 'stage1322_blockerRuProfileIncomplete',
      actionLabelKey: 'stage1322_blockerRuProfileIncompleteAction',
      messageRu: 'Реквизиты заполнены не полностью. Проверьте ФИО, ИНН, БИК и номер счёта.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Исправить реквизиты',
    },
    REFERRAL_RU_INN_CHECKSUM_INVALID: {
      messageKey: 'stage1322_blockerInnInvalid',
      actionLabelKey: 'stage1322_blockerInnInvalidAction',
      messageRu: 'ИНН не прошёл проверку контрольной суммы. Убедитесь, что цифры введены верно.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Исправить ИНН',
    },
    REFERRAL_PAYOUT_BLOCKED: {
      messageKey: 'stage1322_blockerPayoutBlocked',
      actionLabelKey: 'stage1322_blockerPayoutBlockedAction',
      messageRu:
        'Вывод заблокирован службой безопасности: реквизиты совпали с другим аккаунтом или есть открытое расследование.',
      actionHref: '/help/escrow-protection',
      actionLabel: 'Связаться с поддержкой',
    },
    FRAUD_QUEUE_OPEN: {
      messageKey: 'stage1322_blockerFraudQueue',
      actionLabelKey: 'stage1322_blockerFraudQueueAction',
      messageRu: 'Есть открытая проверка по реферальной программе. Вывод будет доступен после решения модератора.',
      actionHref: '/profile/wallet',
      actionLabel: 'Статус баланса',
    },
    REFERRAL_WITHDRAWAL_RATE_LIMIT: {
      messageKey: 'stage1322_blockerRateLimit',
      actionLabelKey: 'stage1322_blockerRateLimitAction',
      messageRu: 'Превышен лимит заявок на вывод (не более 5 за 30 дней). Попробуйте позже.',
      actionHref: '/profile/wallet',
      actionLabel: 'К кошельку',
    },
    REFERRAL_WITHDRAWAL_BLOCKED: {
      messageKey: 'stage1322_blockerWithdrawalBlocked',
      actionLabelKey: 'stage1322_blockerWithdrawalBlockedAction',
      messageRu: 'Вывод временно недоступен. Проверьте статус баланса или обратитесь в поддержку.',
      actionHref: '/profile/wallet',
      actionLabel: 'К кошельку',
    },
  }

  const seen = new Set()
  const out = []
  for (const raw of blockers || []) {
    const code = String(raw || '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    const meta = catalog[code] || {
      messageKey: 'stage1322_blockerGeneric',
      actionLabelKey: 'stage1322_blockerGenericAction',
      messageRu: `Вывод недоступен (${code}). Обратитесь в поддержку, если ошибка повторяется.`,
      actionHref: '/profile/wallet',
      actionLabel: 'К кошельку',
      messageCtx: { code },
    }
    out.push({ code, ...meta })
  }
  return out
}

export default { buildPayoutBlockerDetails }
