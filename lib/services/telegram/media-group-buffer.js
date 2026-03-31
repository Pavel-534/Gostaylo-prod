/**
 * Собирает все сообщения одного альбома Telegram (одинаковый media_group_id),
 * затем через debounce отдаёт их одним батчем в обработчик.
 * In-memory: на serverless возможны редкие гонки между инстансами.
 */

const DEBOUNCE_MS = 1800

/** @type {Map<string, { messages: object[], timer: ReturnType<typeof setTimeout>|null, firstName: string, lang: string, chatId: number | string }>} */
const buffers = new Map()

/**
 * @param {number|string} chatId
 * @param {object} message — Telegram message с photo
 * @param {string} firstName
 * @param {'ru'|'en'} lang
 * @param {(chatId: number|string, messages: object[], firstName: string, lang: 'ru'|'en') => void | Promise<void>} onFlush
 * @returns {boolean} true если сообщение поставлено в очередь альбома (ответ webhook можно сразу ok)
 */
export function scheduleAlbumPhoto(chatId, message, firstName, lang, onFlush) {
  const mg = message?.media_group_id
  if (mg == null) return false

  const key = `${chatId}:${mg}`
  let entry = buffers.get(key)
  if (!entry) {
    entry = { messages: [], timer: null, firstName, lang, chatId }
    buffers.set(key, entry)
  }
  entry.messages.push(message)
  entry.firstName = firstName
  entry.lang = lang

  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => {
    buffers.delete(key)
    const batch = [...entry.messages].sort((a, b) => (a.message_id || 0) - (b.message_id || 0))
    Promise.resolve(onFlush(entry.chatId, batch, entry.firstName, entry.lang)).catch((err) => {
      console.error('[MEDIA_GROUP_BUFFER] flush error', err)
    })
  }, DEBOUNCE_MS)

  return true
}
