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
 */
export async function notifySystemAlert(htmlMessage) {
  try {
    const { NotificationService } = await import('./notification.service.js')
    await NotificationService.sendSystemAlert(htmlMessage)
  } catch (e) {
    console.warn('[system-alert] notify failed:', e?.message || e)
  }
}
