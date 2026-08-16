/**
 * Stage 124.13 — форматирование Owner Digest (email + Telegram).
 * Stage 201.69 — email HTML on premium chrome (logo SSOT).
 */
import {
  premiumEmailDocument,
  emailTitleRow,
  emailContentParagraph,
  emailMutedBox,
  emailCtaStack,
  escapeHtml,
} from '@/lib/email/premium-email-html';
import { theme } from '@/lib/theme/constants'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'

const { colors, fonts } = theme
const fontFamilyEmail = fonts.main

function thb(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `฿${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
}

function roiStr(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestPlainText(digest) {
  const s = digest.summary || {}
  const lines = [
    `${getSiteDisplayName()} — еженедельный дайджест маркетинга`,
    `Период: ${digest.periodLabel || '7 дней'}`,
    '',
    `ROI программы: ${roiStr(s.roiIndex)}`,
    `CAC (средний): ${s.cacThb != null ? thb(s.cacThb) : '—'}`,
    `Привлечено гостей: ${s.guestsAcquired ?? 0}`,
    `Расход promo: ${thb(s.spendThb)}`,
    `Комиссия: ${thb(s.commissionThb)}`,
    `Чистая маржа рефералки: ${thb(s.netMarginThb)}`,
    `Остаток promo tank: ${thb(s.promoTankBalanceThb)}`,
    '',
  ]

  if (digest.campaignRankings?.top?.length) {
    lines.push('Топ кампаний (ROI):')
    for (const c of digest.campaignRankings.top) {
      lines.push(`  • ${c.campaignName}: ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}`)
    }
    lines.push('')
  }

  if (digest.campaignRankings?.worst?.length) {
    lines.push('Требуют внимания:')
    for (const c of digest.campaignRankings.worst) {
      lines.push(`  • ${c.campaignName}: ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}`)
    }
    lines.push('')
  }

  if (digest.alerts?.length) {
    lines.push('Алерты:')
    for (const a of digest.alerts) {
      lines.push(`  • ${a.message}`)
    }
    lines.push('')
  }

  if (digest.recommendations?.length) {
    lines.push('Выводы:')
    for (const r of digest.recommendations) {
      lines.push(`  • ${r}`)
    }
    lines.push('')
  }

  const base = getPublicSiteUrl()
  lines.push(`ROI-пульт: ${base}/admin/marketing/roi`)
  lines.push(`Financial Intelligence: ${base}/admin/finance/intelligence`)

  return lines.join('\n')
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestHtml(digest) {
  const s = digest.summary || {}
  const base = getPublicSiteUrl()
  const period = String(digest.periodLabel || '7 дней')

  const kpiRow = (label, value) =>
    `<tr>` +
    `<td style="padding:8px 0;color:${colors.muted};font-size:13px;font-family:${fontFamilyEmail};">${escapeHtml(label)}</td>` +
    `<td style="padding:8px 0;font-weight:600;font-size:14px;text-align:right;color:${colors.text};font-family:${fontFamilyEmail};">${escapeHtml(value)}</td>` +
    `</tr>`

  const campaignList = (title, rows) => {
    if (!rows?.length) return ''
    const items = rows
      .map(
        (c) =>
          `• <strong>${escapeHtml(c.campaignName)}</strong> — ROI ${roiStr(c.roiIndex)}, расход ${thb(c.spendThb)}`,
      )
      .join('<br/>')
    return emailContentParagraph(`<span style="font-weight:700;">${escapeHtml(title)}</span><br/>${items}`)
  }

  const alertsHtml =
    digest.alerts?.length > 0
      ? emailMutedBox(
          `<span style="font-weight:700;">Алерты</span><br/>` +
            digest.alerts.map((a) => `• ${escapeHtml(a.message)}`).join('<br/>'),
        )
      : ''

  const recHtml =
    digest.recommendations?.length > 0
      ? emailMutedBox(
          `<span style="font-weight:700;">Рекомендации</span><br/>` +
            digest.recommendations.map((r) => `• ${escapeHtml(r)}`).join('<br/>'),
        )
      : ''

  const kpiTable = `
<tr>
  <td style="padding:8px 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${colors.divider};border-bottom:1px solid ${colors.divider};">
      ${kpiRow('ROI программы', roiStr(s.roiIndex))}
      ${kpiRow('CAC (средний)', s.cacThb != null ? thb(s.cacThb) : '—')}
      ${kpiRow('Привлечено гостей', String(s.guestsAcquired ?? 0))}
      ${kpiRow('Расход promo', thb(s.spendThb))}
      ${kpiRow('Комиссия', thb(s.commissionThb))}
      ${kpiRow('Чистая маржа рефералки', thb(s.netMarginThb))}
      ${kpiRow('Promo tank', thb(s.promoTankBalanceThb))}
    </table>
  </td>
</tr>`

  const bodyRowsHtml = [
    emailTitleRow('Еженедельный дайджест маркетинга'),
    emailContentParagraph(escapeHtml(`Период: ${period}`)),
    kpiTable,
    alertsHtml,
    campaignList('Топ-3 кампании', digest.campaignRankings?.top),
    campaignList('Анти-топ (низкий ROI)', digest.campaignRankings?.worst),
    recHtml,
    emailCtaStack({
      primary: { href: `${base}/admin/marketing/roi`, label: 'Открыть ROI-пульт' },
      secondary: [{ href: `${base}/admin/finance/intelligence`, label: 'Financial Intelligence' }],
    }),
    emailContentParagraph(
      `<span style="font-size:12px;color:${colors.subtle};">Read-only отчёт. Настройки: админка → Маркетинг → ROI.</span>`,
    ),
  ].join('')

  return premiumEmailDocument({
    preheader: `${getSiteDisplayName()} — дайджест маркетинга (${period})`,
    bodyRowsHtml,
  })
}

/**
 * @param {Record<string, unknown>} digest
 */
export function buildOwnerDigestTelegramHtml(digest) {
  const s = digest.summary || {}
  const base = getPublicSiteUrl()
  const lines = [
    `<b>📊 Дайджест маркетинга</b> (${escapeHtml(digest.periodLabel || '7д')})`,
    '',
    `ROI: <b>${roiStr(s.roiIndex)}</b> · CAC: <b>${s.cacThb != null ? thb(s.cacThb) : '—'}</b>`,
    `Гости: <b>${s.guestsAcquired ?? 0}</b> · Расход: <b>${thb(s.spendThb)}</b>`,
    `Net рефералки: <b>${thb(s.netMarginThb)}</b> · Tank: <b>${thb(s.promoTankBalanceThb)}</b>`,
  ]

  if (digest.campaignRankings?.top?.[0]) {
    const t = digest.campaignRankings.top[0]
    lines.push('', `🏆 Топ: ${escapeHtml(t.campaignName)} (ROI ${roiStr(t.roiIndex)})`)
  }
  if (digest.campaignRankings?.worst?.[0]) {
    const w = digest.campaignRankings.worst[0]
    lines.push(`⚠️ Анти-топ: ${escapeHtml(w.campaignName)} (ROI ${roiStr(w.roiIndex)})`)
  }
  if (digest.alerts?.length) {
    lines.push('', '<b>Алерты:</b>')
    for (const a of digest.alerts.slice(0, 4)) {
      lines.push(`• ${escapeHtml(a.message)}`)
    }
  }
  if (digest.recommendations?.[0]) {
    lines.push('', `💡 ${escapeHtml(digest.recommendations[0])}`)
  }
  lines.push('', `<a href="${base}/admin/marketing/roi">ROI-пульт</a>`)
  return lines.join('\n')
}
