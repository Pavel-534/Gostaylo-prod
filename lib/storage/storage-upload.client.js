/**
 * Browser uploads via POST /api/v2/upload (no service key in client). Stage 95.0+
 */

import { STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'

/**
 * Нормализованный ответ upload API (обратная совместимость: url/path без thumb).
 * @param {Record<string, unknown>} json
 */
export function normalizeUploadApiResponse(json) {
  if (!json || json.success !== true) return json
  return {
    ...json,
    /** Основной прокси-URL (как раньше) */
    url: json.url,
    path: json.path,
    filename: json.filename,
    publicUrl: json.publicUrl,
    /** Stage 95.2 — lightweight thumbnail, если сервер сгенерировал */
    thumbUrl: json.thumbUrl ?? null,
    thumbPath: json.thumbPath ?? null,
    thumbPublicUrl: json.thumbPublicUrl ?? null,
  }
}

/**
 * @param {FormData} formData
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 */
export async function uploadViaApi(formData, opts = {}) {
  const onProgress = opts.onProgress

  if (typeof onProgress === 'function' && typeof XMLHttpRequest !== 'undefined') {
    return normalizeUploadApiResponse(await uploadViaXhr(formData, onProgress))
  }

  const res = await fetch('/api/v2/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    const err = new Error(json.error || 'Upload failed')
    err.status = res.status
    throw err
  }
  return normalizeUploadApiResponse(json)
}

function uploadViaXhr(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/v2/upload')
    xhr.withCredentials = true
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
      }
    })
    xhr.addEventListener('load', () => {
      let json = {}
      try {
        json = JSON.parse(xhr.responseText || '{}')
      } catch {
        reject(new Error('Invalid response'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300 || !json.success) {
        const err = new Error(json.error || 'Upload failed')
        err.status = xhr.status
        reject(err)
        return
      }
      onProgress(100)
      resolve(json)
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.send(formData)
  })
}

/**
 * Upload profile avatar (bucket `avatars`, path `{profileId}/…`).
 */
export async function uploadAvatar(file, profileId, opts = {}) {
  const safeId = String(profileId || '').replace(/\//g, '')
  const fd = new FormData()
  fd.append('file', file, file.name || 'avatar.webp')
  fd.append('bucket', STORAGE_BUCKETS.AVATARS)
  fd.append('profile', 'avatar')
  fd.append('objectPath', `${safeId}/${Date.now()}.webp`)
  fd.append('upsert', 'true')
  return uploadViaApi(fd, opts)
}

export async function uploadListingPhoto(file, listingId, objectPath, opts = {}) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'photo.webp')
  fd.append('bucket', STORAGE_BUCKETS.LISTING_IMAGES)
  fd.append('profile', 'listing_photo')
  fd.append('objectPath', objectPath)
  fd.append('upsert', 'true')
  const res = await uploadViaApi(fd, opts)
  return res
}

export async function deleteViaApi(bucket, path) {
  const res = await fetch('/api/v2/upload', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Delete failed')
  }
  return json
}
