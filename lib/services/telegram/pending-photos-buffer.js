/**
 * Временный буфер file_id фото до прихода текстового описания (один чат = одна очередь).
 * Файлы в Storage не пишем, пока нет текста — меньше мусора при отвале пользователя.
 */

const TTL_MS = 45 * 60 * 1000

/** @type {Map<string, { fileIds: string[], firstName: string, lang: 'ru'|'en', updatedAt: number }>} */
const byChat = new Map()

function key(chatId) {
  return String(chatId)
}

export function setPendingPhotos(chatId, fileIds, firstName, lang) {
  byChat.set(key(chatId), {
    fileIds: [...fileIds],
    firstName,
    lang: lang === 'ru' ? 'ru' : 'en',
    updatedAt: Date.now(),
  })
}

export function hasPendingPhotos(chatId) {
  const k = key(chatId)
  const v = byChat.get(k)
  if (!v) return false
  if (Date.now() - v.updatedAt > TTL_MS) {
    byChat.delete(k)
    return false
  }
  return true
}

/**
 * @returns {{ fileIds: string[], firstName: string, lang: 'ru'|'en' } | null}
 */
export function takePendingPhotos(chatId) {
  const k = key(chatId)
  const v = byChat.get(k)
  if (!v) return null
  byChat.delete(k)
  if (Date.now() - v.updatedAt > TTL_MS) return null
  return { fileIds: v.fileIds, firstName: v.firstName, lang: v.lang }
}

/** Вернуть буфер в очередь (например, после ошибки парсинга). */
export function restorePendingPhotos(chatId, fileIds, firstName, lang) {
  setPendingPhotos(chatId, fileIds, firstName, lang)
}

export function clearPendingPhotos(chatId) {
  byChat.delete(key(chatId))
}
