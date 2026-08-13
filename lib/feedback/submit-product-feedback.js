/**
 * Deliver product feedback to ops (Telegram system alerts + support email).
 * Stage 200.137 — Phase 1 has no DB queue; separate from booking chat escalate.
 */

import { getSupportInboxEmail } from '@/lib/config/support-inbox-email.js'
import { getSiteDisplayName } from '@/lib/site-url'
import { escapeHtml } from '@/lib/email/premium-email-html'
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
    const html = [
      `<p><b>Category:</b> ${escapeHtml(categoryLabel)} (<code>${escapeHtml(payload.category)}</code>)</p>`,
      `<p><b>Audience:</b> ${escapeHtml(audience)}${payload.role ? ` (${escapeHtml(payload.role)})` : ''}</p>`,
      `<p><b>User:</b> ${escapeHtml(payload.userId)}${payload.email ? ` · ${escapeHtml(payload.email)}` : ''}</p>`,
      `<p><b>Page:</b> ${escapeHtml(pageRef)}</p>`,
      payload.userAgent ? `<p><b>UA:</b> ${escapeHtml(payload.userAgent.slice(0, 300))}</p>` : '',
      `<p><b>Details:</b></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(payload.details)}</pre>`,
    ]
      .filter(Boolean)
      .join('\n')

    void EmailService.sendEmail(supportTo, { subject, html }).catch((e) => {
      console.warn('[product-feedback] email failed:', e?.message || e)
    })
  }

  return { ok: true }
}
