/**
 * Загрузка вложения в chat-attachments через POST /api/v2/upload (сессия).
 * Возвращает proxy-URL (/_storage/...) для вставки в сообщение.
 *
 * @param {File|Blob} file
 * @param {string} userId
 * @param {string} [subfolder] — например `images`, `files`, `voice` (папка `${userId}/chat/${subfolder}`)
 */
export async function uploadChatFile(file, userId, subfolder = '') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('bucket', 'chat-attachments')
  const folder = subfolder ? `${userId}/chat/${subfolder}` : `${userId}/chat`
  fd.append('folder', folder)
  const res = await fetch('/api/v2/upload', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Upload failed')
  }
  return { url: json.url, path: json.path, filename: json.filename }
}

/** Голосовые сообщения — отдельная папка и те же правила audio/* на сервере */
export async function uploadChatVoice(file, userId) {
  return uploadChatFile(file, userId, 'voice')
}
