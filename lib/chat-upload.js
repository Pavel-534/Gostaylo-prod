/**
 * Загрузка вложения в chat-attachments через POST /api/v2/upload (сессия).
 * Возвращает proxy-URL (/_storage/...) для вставки в сообщение.
 * Изображения: клиентское сжатие по профилю `chat_image` (SSOT compress-image-browser + media-profiles) + тот же профиль на сервере.
 *
 * @param {File|Blob} file
 * @param {string} userId
 * @param {string} [subfolder] — например `images`, `files`, `voice` (папка `${userId}/chat/${subfolder}`)
 */
export async function uploadChatFile(file, userId, subfolder = '') {
  const mime = typeof file?.type === 'string' ? file.type : ''
  let payload = file
  let filename = typeof file?.name === 'string' && file.name.trim() ? file.name : 'upload.bin'

  if (mime.startsWith('image/')) {
    const { compressImageForBrowser } = await import('@/lib/services/media/compress-image-browser')
    payload = await compressImageForBrowser(file, 'chat_image')
    filename = `${Date.now()}.webp`
  }

  const fd = new FormData()
  fd.append('file', payload, filename)
  fd.append('bucket', 'chat-attachments')
  if (mime.startsWith('image/')) {
    fd.append('profile', 'chat_image')
  }
  const folder = subfolder ? `${userId}/chat/${subfolder}` : `${userId}/chat`
  fd.append('folder', folder)
  const { uploadViaApi } = await import('@/lib/storage/storage-upload.client')
  const json = await uploadViaApi(fd)
  return { url: json.url, path: json.path, filename: json.filename }
}

/** Голосовые сообщения — отдельная папка и те же правила audio/* на сервере */
export async function uploadChatVoice(file, userId) {
  return uploadChatFile(file, userId, 'voice')
}
