/**
 * Parse Supabase Storage URLs / proxy paths → `{ bucket, path }`.
 * Stage 95.1+ — shared by upload cleanup, orphan scanner, listing delete.
 */

/** @param {string} mainStoragePath */
export function buildThumbStoragePath(mainStoragePath) {
  const s = String(mainStoragePath || '').replace(/^\/+/, '')
  if (!s) return s
  const slash = s.lastIndexOf('/')
  if (slash >= 0) {
    const dir = s.slice(0, slash + 1)
    const file = s.slice(slash + 1)
    const base = file.replace(/\.[^./\\]+$/i, '')
    return `${dir}thumb_${base}.webp`
  }
  const base = s.replace(/\.[^./\\]+$/i, '')
  return `thumb_${base}.webp`
}

/** @param {string} path */
export function isThumbStoragePath(path) {
  const file = String(path || '').split('/').pop() || ''
  return file.startsWith('thumb_')
}

const BUCKET_IDS = [
  'avatars',
  'listing-images',
  'listings',
  'review-images',
  'chat-attachments',
  'verification_documents',
  'dispute-evidence',
]

/**
 * @param {string | null | undefined} raw
 * @returns {{ bucket: string, path: string } | null}
 */
export function parseStorageObjectRef(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const base = s.split('?')[0].split('#')[0]

  const proxy = base.match(/^\/?_storage\/([^/]+)\/(.+)$/i)
  if (proxy) {
    return { bucket: proxy[1], path: proxy[2].replace(/^\/+/, '') }
  }

  const pub = base.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/i)
  if (pub) {
    try {
      return { bucket: pub[1], path: decodeURIComponent(pub[2].replace(/^\/+/, '')) }
    } catch {
      return { bucket: pub[1], path: pub[2].replace(/^\/+/, '') }
    }
  }

  for (const bucket of BUCKET_IDS) {
    const idx = base.indexOf(`/${bucket}/`)
    if (idx >= 0) {
      return { bucket, path: base.slice(idx + bucket.length + 2).replace(/^\/+/, '') }
    }
  }

  return null
}

/**
 * @param {string} bucket
 * @param {string} path
 * @returns {string}
 */
export function storageRefKey(bucket, path) {
  return `${bucket}::${String(path || '').replace(/^\/+/, '')}`
}

/**
 * @param {unknown} value
 * @param {Set<string>} into
 */
export function addStorageRefFromValue(value, into) {
  if (value == null) return
  if (Array.isArray(value)) {
    for (const v of value) addStorageRefFromValue(v, into)
    return
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) addStorageRefFromValue(v, into)
    return
  }
  const ref = parseStorageObjectRef(String(value))
  if (!ref?.bucket || !ref.path) return
  into.add(storageRefKey(ref.bucket, ref.path))
  if (!isThumbStoragePath(ref.path)) {
    const thumbPath = buildThumbStoragePath(ref.path)
    if (thumbPath) into.add(storageRefKey(ref.bucket, thumbPath))
  }
}
