/**
 * Stage 201.69 — simple transactional emails on premium chrome SSOT.
 * Use for auth, ops, and NotificationService plain→HTML (via textToHtml).
 */

import { getSiteDisplayName } from '@/lib/site-url.js'
import {
  premiumEmailDocument,
  emailTitleRow,
  emailContentParagraph,
  emailMutedBox,
  emailCtaStack,
  escapeHtml,
} from '@/lib/email/premium-email-html.js'

/** Strip leading emoji / symbols for a readable H1 from subject lines. */
export function emailTitleFromSubject(subject) {
  const s = String(subject || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || getSiteDisplayName()
}

/**
 * @param {object} opts
 * @param {string} opts.subject
 * @param {string} [opts.preheader]
 * @param {string} [opts.title]
 * @param {string[]} [opts.paragraphs] — plain text (escaped)
 * @param {string[]} [opts.mutedParagraphs] — plain text in tint box
 * @param {{ href: string, label: string }} [opts.cta]
 * @param {string} [opts.extraBodyRowsHtml] — already-safe HTML table rows
 * @returns {{ subject: string, html: string }}
 */
export function buildSimplePremiumEmailTemplate(opts) {
  const subject = String(opts.subject || getSiteDisplayName())
  const title = opts.title != null ? String(opts.title) : emailTitleFromSubject(subject)
  const rows = []

  if (title) rows.push(emailTitleRow(title))

  for (const p of opts.paragraphs || []) {
    const text = String(p ?? '')
    if (!text.trim()) continue
    rows.push(emailContentParagraph(escapeHtml(text).replace(/\n/g, '<br/>')))
  }

  const muted = (opts.mutedParagraphs || []).map((p) => String(p ?? '').trim()).filter(Boolean)
  if (muted.length) {
    rows.push(emailMutedBox(muted.map((p) => escapeHtml(p).replace(/\n/g, '<br/>')).join('<br/><br/>')))
  }

  if (opts.extraBodyRowsHtml) {
    rows.push(opts.extraBodyRowsHtml)
  }

  if (opts.cta?.href && opts.cta?.label) {
    rows.push(emailCtaStack({ primary: { href: opts.cta.href, label: opts.cta.label } }))
  }

  const preheader =
    opts.preheader ||
    (opts.paragraphs || []).find((p) => String(p || '').trim()) ||
    title

  return {
    subject,
    html: premiumEmailDocument({
      preheader: String(preheader).slice(0, 140),
      bodyRowsHtml: rows.join(''),
    }),
  }
}

/**
 * Convert NotificationService plain text into branded premium HTML.
 * @param {string} subject
 * @param {string} textBody
 * @param {{ title?: string, preheader?: string, cta?: { href: string, label: string } }} [opts]
 */
export function buildPremiumHtmlFromPlainText(subject, textBody, opts = {}) {
  const lines = String(textBody ?? '').split('\n')
  const paragraphs = []
  let buf = []

  const flush = () => {
    if (buf.length) {
      paragraphs.push(buf.join('\n'))
      buf = []
    }
  }

  for (const line of lines) {
    if (line.trim() === '') flush()
    else buf.push(line)
  }
  flush()

  return buildSimplePremiumEmailTemplate({
    subject: subject || getSiteDisplayName(),
    title: opts.title || emailTitleFromSubject(subject),
    preheader: opts.preheader,
    paragraphs,
    cta: opts.cta,
  }).html
}
