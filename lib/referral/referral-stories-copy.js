/**
 * Тексты для PNG Stories по языку профиля (Stage 74.2). Ключи: ru | en | zh | th
 */

const BADGE_LABELS = {
  fast_start: {
    ru: 'Быстрый старт',
    en: 'Fast Start',
    zh: '快速起步',
    th: 'เริ่มต้นเร็ว',
  },
  network_builder: {
    ru: 'Сеть растёт',
    en: 'Network Builder',
    zh: '网络建设者',
    th: 'ผู้สร้างเครือข่าย',
  },
  top10_monthly: {
    ru: 'Топ‑10 месяца',
    en: 'Top 10 Monthly',
    zh: '本月前十',
    th: 'ท็อป 10 ประจำเดือน',
  },
}

/** @param {string} lang raw from profile */
export function normalizeStoriesLang(lang) {
  const l = String(lang || '')
    .trim()
    .slice(0, 2)
    .toLowerCase()
  if (l === 'zh') return 'zh'
  if (l === 'th') return 'th'
  if (l === 'en') return 'en'
  return 'ru'
}

export function badgeLabelForLang(badgeId, langNorm) {
  const row = BADGE_LABELS[badgeId]
  if (!row) return ''
  return row[langNorm] || row.en || ''
}

export function buildStoriesCopy(langNorm, ctx) {
  const brand = String(ctx.brandName || 'Platform').trim() || 'Platform'
  const tier = String(ctx.tierName || '').trim()
  const badge = String(ctx.badgeLabel || '').trim()
  const net = Number(ctx.monthlyNetworkEarnedThb) || 0
  const netStr = Number.isFinite(net) ? net.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'

  const lines = {
    ru: {
      teamHeadline: 'Доход моей команды',
      teamAmount: `฿${netStr}`,
      teamCta: 'Моя команда растёт — присоединяйся!',
      ambassadorBadgeLine: badge ? `🏆 ${badge}` : '',
    },
    en: {
      teamHeadline: 'My team earnings',
      teamAmount: `฿${netStr}`,
      teamCta: 'My team is growing — join us!',
      ambassadorBadgeLine: badge ? `🏆 ${badge}` : '',
    },
    zh: {
      teamHeadline: '我的团队收益',
      teamAmount: `฿${netStr}`,
      teamCta: '我的团队在成长——快来加入！',
      ambassadorBadgeLine: badge ? `🏆 ${badge}` : '',
    },
    th: {
      teamHeadline: 'รายได้ทีมของฉัน',
      teamAmount: `฿${netStr}`,
      teamCta: 'ทีมโตแล้ว — มาร่วมด้วย!',
      ambassadorBadgeLine: badge ? `🏆 ${badge}` : '',
    },
  }
  const L = lines[langNorm] || lines.en
  return {
    language: langNorm,
    brandName: brand,
    tierName: tier,
    teamHeadline: L.teamHeadline,
    teamAmountLine: L.teamAmount,
    teamCtaLine: L.teamCta,
    ambassadorBadgeLine: L.ambassadorBadgeLine,
  }
}
