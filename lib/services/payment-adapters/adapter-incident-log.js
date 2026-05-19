/**
 * Stage 106.1 — log acquiring adapter failures (no silent mock in production).
 */

import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

/**
 * @param {string} adapterKey
 * @param {Record<string, unknown> | string} detail
 */
export async function logPaymentAdapterIncident(adapterKey, detail) {
  const msg =
    typeof detail === 'string' ? detail : JSON.stringify(detail, null, 0).slice(0, 1200)
  console.error(`[PAYMENT_ADAPTER:${adapterKey}]`, msg)
  void notifySystemAlert(
    `💳 <b>Платёжный адаптер ${escapeSystemAlertHtml(adapterKey)}</b>\n` +
      `<code>${escapeSystemAlertHtml(msg)}</code>`,
  )
}
