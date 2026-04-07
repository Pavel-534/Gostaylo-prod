/**
 * Мастер-разметка писем в светлом премиальном стиле (inline CSS).
 * Все цвета/радиусы — из lib/theme/constants.js
 */

import { theme } from '@/lib/theme/constants'
import { getPublicSiteUrl } from '@/lib/site-url'

const { colors, borderRadius, fonts, shadows } = theme

/** Полный font-family для body и ключевых ячеек (Outlook часто сбрасывает наследование). */
const fontFamilyEmail = fonts.main

export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function absUrl(href) {
  const base = getPublicSiteUrl()
  if (!href) return base
  const h = String(href)
  if (h.startsWith('http://') || h.startsWith('https://')) return h
  return `${base}${h.startsWith('/') ? '' : '/'}${h}`
}

export function emailPrimaryButton(href, label) {
  const u = absUrl(href)
  return (
    `<a href="${escapeHtml(u)}" ` +
    `style="display:inline-block;background-color:${colors.primary};color:${colors.primaryForeground};` +
    `text-decoration:none;padding:14px 28px;border-radius:${borderRadius};font-weight:600;font-size:15px;` +
    `mso-padding-alt:0;">${escapeHtml(label)}</a>`
  )
}

export function emailSecondaryButton(href, label) {
  const u = absUrl(href)
  return (
    `<a href="${escapeHtml(u)}" ` +
    `style="display:inline-block;background-color:${colors.background};color:${colors.text};` +
    `text-decoration:none;padding:12px 26px;border-radius:${borderRadius};font-weight:600;font-size:15px;` +
    `border:1px solid ${colors.border};mso-padding-alt:0;">${escapeHtml(label)}</a>`
  )
}

export function emailHeaderRow() {
  return `
<tr>
  <td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid ${colors.divider};">
    <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${colors.primary};font-family:${fontFamilyEmail};">GoStayLo</p>
    <p style="margin:8px 0 0;font-size:13px;color:${colors.muted};line-height:1.4;font-family:${fontFamilyEmail};">Premium rentals in Phuket</p>
  </td>
</tr>`
}

export function emailFooterInsideCard() {
  const y = new Date().getFullYear()
  return `
<tr>
  <td style="padding:24px 32px 28px;text-align:center;border-top:1px solid ${colors.divider};">
    <p style="margin:0;color:${colors.subtle};font-size:12px;line-height:1.5;">© ${y} GoStayLo · Phuket, Thailand</p>
  </td>
</tr>`
}

/**
 * @param {{ preheader?: string, bodyRowsHtml: string }} opts
 */
export function premiumEmailDocument(opts) {
  const pre = opts.preheader || ''
  const hiddenPre = pre
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(pre)}</div>`
    : ''
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
</head>
<body style="margin:0;padding:0;background-color:${colors.canvas};font-family:${fontFamilyEmail};-webkit-font-smoothing:antialiased;">
  ${hiddenPre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${colors.background};border-radius:${borderRadius};border:1px solid ${colors.border};font-family:${fontFamilyEmail};${shadows.card}">
          ${emailHeaderRow()}
          ${opts.bodyRowsHtml}
          ${emailFooterInsideCard()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Карточка объекта: фото, заголовок, даты, цена (светлый Airbnb-like блок).
 * @param {{ imageUrl?: string | null, imageAlt: string, title: string, subtitle?: string, datesLine: string, priceLine: string }} opts
 */
export function emailListingCardBlock({
  imageUrl,
  imageAlt,
  title,
  subtitle,
  datesLine,
  priceLine,
}) {
  const absImg = imageUrl ? absUrl(imageUrl) : null
  const alt = escapeHtml(imageAlt || title || 'GoStayLo — объект')
  const imgRow = absImg
    ? `<tr><td style="padding:0;line-height:0;">
  <img src="${escapeHtml(absImg)}" alt="${alt}" width="568"
    style="display:block;width:100%;height:auto;max-height:240px;object-fit:cover;border:0;border-radius:${borderRadius} ${borderRadius} 0 0;" />
</td></tr>`
    : ''

  const sub = subtitle
    ? `<p style="margin:6px 0 0;font-size:14px;color:${colors.muted};font-family:${fontFamilyEmail};">${escapeHtml(subtitle)}</p>`
    : ''

  return `
<tr>
  <td style="padding:24px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${colors.border};border-radius:${borderRadius};overflow:hidden;${shadows.soft}">
      ${imgRow}
      <tr>
        <td style="padding:20px 20px 8px;background-color:${colors.background};">
          <p style="margin:0;font-size:18px;font-weight:700;color:${colors.text};line-height:1.3;font-family:${fontFamilyEmail};">${escapeHtml(title)}</p>
          ${sub}
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 20px;background-color:${colors.background};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${colors.divider};">
            <tr>
              <td style="padding:14px 0 0;font-size:14px;color:${colors.muted};width:50%;vertical-align:top;">Даты</td>
              <td style="padding:14px 0 0;font-size:14px;color:${colors.text};font-weight:600;text-align:right;vertical-align:top;">${escapeHtml(datesLine)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 0;font-size:14px;color:${colors.muted};">К оплате</td>
              <td style="padding:10px 0 0;font-size:18px;color:${colors.primary};font-weight:700;text-align:right;">${escapeHtml(priceLine)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function emailContentParagraph(htmlSafeOrPlain) {
  return `
<tr>
  <td style="padding:0 32px 8px;">
    <p style="margin:0;font-size:16px;line-height:1.65;color:${colors.text};font-family:${fontFamilyEmail};">${htmlSafeOrPlain}</p>
  </td>
</tr>`
}

export function emailMutedBox(htmlInner) {
  return `
<tr>
  <td style="padding:8px 32px 8px;">
    <div style="background-color:${colors.tint};border:1px solid ${colors.border};border-radius:${borderRadius};padding:16px 18px;">
      <p style="margin:0;font-size:14px;line-height:1.55;color:${colors.text};font-family:${fontFamilyEmail};">${htmlInner}</p>
    </div>
  </td>
</tr>`
}

export function emailTitleRow(text) {
  return `
<tr>
  <td style="padding:8px 32px 12px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;line-height:1.25;font-family:${fontFamilyEmail};">${escapeHtml(text)}</h1>
  </td>
</tr>`
}

/**
 * Вертикальный стек CTA с отступами (основная + вторичные).
 * @param {{ primary?: { href: string, label: string }, secondary?: Array<{ href: string, label: string }> }} actions
 */
export function emailCtaStack(actions) {
  const rows = []
  if (actions.primary) {
    rows.push(`
<tr>
  <td style="padding:20px 32px 8px;text-align:center;">
    ${emailPrimaryButton(actions.primary.href, actions.primary.label)}
  </td>
</tr>`)
  }
  const sec = actions.secondary || []
  for (const s of sec) {
    rows.push(`
<tr>
  <td style="padding:8px 32px;text-align:center;">
    ${emailSecondaryButton(s.href, s.label)}
  </td>
</tr>`)
  }
  return rows.join('')
}

/**
 * Кнопки календаря: Google, Outlook, .ics (адаптивное число колонок).
 */
export function emailCalendarRow({ googleUrl, outlookUrl, icsUrl, caption, labelGoogle, labelOutlook, labelIcal }) {
  const cells = []
  if (googleUrl) cells.push({ href: googleUrl, label: labelGoogle })
  if (outlookUrl) cells.push({ href: outlookUrl, label: labelOutlook })
  if (icsUrl) cells.push({ href: icsUrl, label: labelIcal })
  if (cells.length === 0) return ''

  const colSpan = Math.min(cells.length, 3)
  const cap = caption
    ? `<tr><td colspan="${colSpan}" style="padding:0 0 10px;font-size:13px;color:${colors.muted};text-align:center;line-height:1.45;font-family:${fontFamilyEmail};">${escapeHtml(caption)}</td></tr>`
    : ''

  const widthPct = cells.length === 1 ? '100%' : cells.length === 2 ? '50%' : '33%'
  const row = `<tr>${cells
    .map(
      (c) =>
        `<td style="width:${widthPct};padding:6px 4px;text-align:center;vertical-align:top;">${emailSecondaryButton(c.href, c.label)}</td>`,
    )
    .join('')}</tr>`

  return `
<tr>
  <td style="padding:4px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${fontFamilyEmail};">
      ${cap}
      ${row}
    </table>
  </td>
</tr>`
}
