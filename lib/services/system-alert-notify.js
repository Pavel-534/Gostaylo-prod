/** Escape user/DB text for Telegram HTML snippets in system alerts */
export function escapeSystemAlertHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Fire-and-forget Telegram system topic (TELEGRAM_SYSTEM_ALERTS_TOPIC_ID).
 * Keeps heavy callers free of duplicate dynamic-import boilerplate.
 * @param {string} htmlMessage
 * @param {{ reply_markup?: { inline_keyboard?: { text: string, url?: string, callback_data?: string }[][] } }} [opts]
 */
export async function notifySystemAlert(htmlMessage, opts = {}) {
  try {
    const { NotificationService } = await import('./notification.service.js')
    await NotificationService.sendSystemAlert(htmlMessage, opts)
  } catch (e) {
    console.warn('[system-alert] notify failed:', e?.message || e)
  }
}
