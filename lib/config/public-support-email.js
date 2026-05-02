/**
 * Публичный email поддержки (mailto на /legal/*, /terms, /help, футер юр. оболочки).
 * Задаётся в NEXT_PUBLIC_SUPPORT_EMAIL; при пустом значении — безопасный dev-заглушка.
 */
export function getPublicSupportEmail() {
  const v = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  if (v != null && String(v).trim() !== '') return String(v).trim()
  return 'support@example.com'
}
