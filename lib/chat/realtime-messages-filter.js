/**
 * Строка filter для Supabase Realtime postgres_changes по таблице messages.
 *
 * Сейчас `useRealtimeMessages` подписывается без server-side filter (фильтр в JS).
 * Эта функция оставлена для будущего возврата серверного фильтра при масштабировании.
 *
 * Без кавычек значение `conv-abc-def` ломает парсер (`=` читает только первый токен).
 * Формат как в PostgREST: column=eq."escaped-value"
 *
 * @param {string|null|undefined} conversationId
 * @returns {string|undefined}
 */
export function buildMessagesRealtimeFilter(conversationId) {
  if (conversationId == null || String(conversationId).trim() === '') return undefined
  const v = String(conversationId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `conversation_id=eq."${v}"`
}
