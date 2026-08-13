/**
 * Публичный email поддержки (mailto на /legal/*, /terms, /help, футер юр. оболочки).
 * Задаётся в NEXT_PUBLIC_SUPPORT_EMAIL; при пустом значении — безопасный dev-заглушка.
 * Ops-письма (product feedback и т.п.) — только через `getSupportInboxEmail()`
 * (`SUPPORT_INBOX_EMAIL` / `PROCESS_SUPPORT_EMAIL`), не через эту функцию.
 */
export function getPublicSupportEmail() {
  const v = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  if (v != null && String(v).trim() !== '') return String(v).trim()
  return 'support@example.com'
}
