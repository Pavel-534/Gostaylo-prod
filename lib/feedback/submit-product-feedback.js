/**
 * Deliver product feedback to ops (Telegram system alerts + support email).
 * Stage 200.137 — Phase 1 has no DB queue; separate from booking chat escalate.
 */

import { getSupportInboxEmail } from '@/lib/config/support-inbox-email.js'
import { getSiteDisplayName } from '@/lib/site-url'
import { buildSimplePremiumEmailTemplate } from '@/lib/email/simple-transactional-email.js'
import { EmailService } from '@/lib/services/email.service.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { logStructured } from '@/lib/critical-telemetry.js'
import {
  labelForProductFeedbackCategory,
  validateProductFeedbackBody,
} from '@/lib/feedback/product-feedback-options.js'

export { validateProductFeedbackBody }

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateBuckets = new Map()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX_PER_WINDOW = 5

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function allowProductFeedbackRate(userId) {
  const id = String(userId || '').trim()
  if (!id) return false
  const now = Date.now()
  let b = rateBuckets.get(id)
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + RATE_WINDOW_MS }
    rateBuckets.set(id, b)
  }
  if (b.count >= RATE_MAX_PER_WINDOW) return false
  b.count += 1
  return true
}

/**
 * @param {{
 *   category: string,
 *   details: string,
 *   pathname: string,
 *   pageUrl: string,
 *   userAgent: string,
 *   language: string,
 *   userId: string,
 *   email: string | null,
 *   audience: string,
 *   role: string | null,
 * }} payload
 */
export async function deliverProductFeedback(payload) {
  const categoryLabel = labelForProductFeedbackCategory(payload.category, 'ru')
  const brand = getSiteDisplayName()
  const pageRef = payload.pageUrl || payload.pathname || '/'
  const audience = payload.audience || 'unknown'

  logStructured({
    module: 'product_feedback',
    stage: '200.137',
    category: payload.category,
    userId: payload.userId,
    pathname: payload.pathname,
    pageUrl: pageRef,
    audience,
    role: payload.role,
  })

  // Every report must reach ops (recordCriticalSignal alone would rate-limit bursts).
  const tgHtml =
    `📝 <b>Product feedback</b> (${escapeSystemAlertHtml(brand)})\n` +
    `category: <code>${escapeSystemAlertHtml(payload.category)}</code> — ${escapeSystemAlertHtml(categoryLabel)}\n` +
    `audience: <code>${escapeSystemAlertHtml(audience)}</code>` +
    (payload.role ? ` · role=<code>${escapeSystemAlertHtml(payload.role)}</code>` : '') +
    `\nuser: <code>${escapeSystemAlertHtml(payload.userId)}</code>` +
    (payload.email ? ` · <code>${escapeSystemAlertHtml(payload.email)}</code>` : '') +
    `\npage: <code>${escapeSystemAlertHtml(pageRef)}</code>\n` +
    (payload.userAgent
      ? `ua: <code>${escapeSystemAlertHtml(payload.userAgent.slice(0, 180))}</code>\n`
      : '') +
    `\n${escapeSystemAlertHtml(payload.details)}`

  void notifySystemAlert(tgHtml, { severity: 'INFO' })

  const supportTo = getSupportInboxEmail()
  if (supportTo) {
    const subject = `[${brand}] Product feedback: ${categoryLabel}`
    const template = buildSimplePremiumEmailTemplate({
      subject,
      preheader: `${categoryLabel} · ${audience}`,
      title: 'Product feedback',
      paragraphs: [
        `Category: ${categoryLabel} (${payload.category})`,
        `Audience: ${audience}${payload.role ? ` (${payload.role})` : ''}`,
        `User: ${payload.userId}${payload.email ? ` · ${payload.email}` : ''}`,
        `Page: ${pageRef}`,
        ...(payload.userAgent ? [`UA: ${payload.userAgent.slice(0, 300)}`] : []),
      ],
      mutedParagraphs: [payload.details],
    })

    void EmailService.sendEmail(supportTo, template).catch((e) => {
      console.warn('[product-feedback] email failed:', e?.message || e)
    })
  }

  return { ok: true }
}
