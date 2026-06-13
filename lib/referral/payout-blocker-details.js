/**
 * Stage 132.0 — SSOT: payout blocker codes → actionable RU copy for wallet UI.
 */

/**
 * @param {string[]} blockers
 * @param {{ minPayoutThb?: number }} [ctx]
 * @returns {{ code: string, messageRu: string, actionHref: string, actionLabel: string }[]}
 */
export function buildPayoutBlockerDetails(blockers, ctx = {}) {
  const minThb = Number(ctx.minPayoutThb ?? 1000)
  const fmtMin = Number.isFinite(minThb)
    ? minThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
    : '1000'

  /** @type {Record<string, Omit<ReturnType<typeof buildPayoutBlockerDetails>[0], 'code'>>} */
  const catalog = {
    BELOW_MIN_PAYOUT: {
      messageRu: `Минимальная сумма для вывода — ${fmtMin} THB. Дождитесь накопления баланса или пригласите друзей.`,
      actionHref: '/profile/referral',
      actionLabel: 'Пригласить друзей',
    },
    PROFILE_NOT_VERIFIED: {
      messageRu: 'Для вывода нужна верификация профиля (KYC). Обычно это занимает 1–2 рабочих дня.',
      actionHref: '/profile',
      actionLabel: 'Открыть профиль',
    },
    WALLET_NOT_CLEARED_FOR_PAYOUT: {
      messageRu: 'Вывод временно закрыт: требуется допуск оператора («Доступен вывод»).',
      actionHref: '/help/escrow-protection',
      actionLabel: 'Как это работает',
    },
    REFERRAL_RU_PAYOUT_PROFILE_REQUIRED: {
      messageRu: 'Укажите реквизиты карты или счёта в банке РФ — без них выплата в рублях невозможна.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Заполнить реквизиты',
    },
    REFERRAL_RU_PAYOUT_PROFILE_INCOMPLETE: {
      messageRu: 'Реквизиты заполнены не полностью. Проверьте ФИО, ИНН, БИК и номер счёта.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Исправить реквизиты',
    },
    REFERRAL_RU_INN_CHECKSUM_INVALID: {
      messageRu: 'ИНН не прошёл проверку контрольной суммы. Убедитесь, что цифры введены верно.',
      actionHref: '/profile/wallet#ru-payout-profile',
      actionLabel: 'Исправить ИНН',
    },
    REFERRAL_PAYOUT_BLOCKED: {
      messageRu:
        'Вывод заблокирован службой безопасности: реквизиты совпали с другим аккаунтом или есть открытое расследование.',
      actionHref: '/help/escrow-protection',
      actionLabel: 'Связаться с поддержкой',
    },
    FRAUD_QUEUE_OPEN: {
      messageRu: 'Есть открытая проверка по реферальной программе. Вывод будет доступен после решения модератора.',
      actionHref: '/profile/wallet',
      actionLabel: 'Статус баланса',
    },
    REFERRAL_WITHDRAWAL_RATE_LIMIT: {
      messageRu: 'Превышен лимит заявок на вывод (не более 5 за 30 дней). Попробуйте позже.',
      actionHref: '/profile/wallet',
      actionLabel: 'К кошельку',
    },
    REFERRAL_WITHDRAWAL_BLOCKED: {
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
      messageRu: `Вывод недоступен (${code}). Обратитесь в поддержку, если ошибка повторяется.`,
      actionHref: '/profile/wallet',
      actionLabel: 'К кошельку',
    }
    out.push({ code, ...meta })
  }
  return out
}

export default { buildPayoutBlockerDetails }
