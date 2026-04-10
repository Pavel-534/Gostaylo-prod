/**
 * Мост: INSERT по messages уже приходит в ChatContext (ctx-messages) и обновляет инбокс.
 * Вторая подписка в треде (useRealtimeMessages) иногда не дублирует событие в браузере.
 * Диспатчим сырую строку в открытый тред — один надёжный путь без второго postgres_changes.
 */
export const REALTIME_MESSAGE_INSERT_EVENT = 'gostaylo:realtime-message-insert'

/**
 * @param {object} message — payload.new из postgres_changes (таблица messages)
 */
export function dispatchRealtimeMessageInsert(message) {
  if (typeof window === 'undefined' || !message) return
  try {
    window.dispatchEvent(new CustomEvent(REALTIME_MESSAGE_INSERT_EVENT, { detail: { message } }))
  } catch {
    /* ignore */
  }
}
