/**
 * Загрузка вложения в chat-attachments через POST /api/v2/upload (сессия).
 * Возвращает proxy-URL (/_storage/...) для вставки в сообщение.
 */
export async function uploadChatFile(file, userId) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('bucket', 'chat-attachments')
  fd.append('folder', `${userId}/chat`)
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
