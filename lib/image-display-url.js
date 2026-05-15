/**
 * Stage 95.3 — SSOT выбора URL для UI: thumb (если есть или derivable) → main.
 * Работает со строками и объектами `{ url, thumbUrl }` из upload API.
 */
import { toPublicImageUrl } from '@/lib/public-image-url'
import {
  parseStorageObjectRef,
  buildThumbStoragePath,
  isThumbStoragePath,
} from '@/lib/storage/storage-path-utils'

/**
 * @param {unknown} value
 * @returns {{ url: string | null, thumbUrl: string | null }}
 */
export function normalizeImageRef(value) {
  if (value == null) return { url: null, thumbUrl: null }
  if (typeof value === 'string') {
    const s = value.trim()
    return s ? { url: s, thumbUrl: null } : { url: null, thumbUrl: null }
  }
  if (typeof value === 'object') {
    const o = /** @type {Record<string, unknown>} */ (value)
    const url =
      (typeof o.url === 'string' && o.url) ||
      (typeof o.publicUrl === 'string' && o.publicUrl) ||
      null
    const thumbUrl =
      (typeof o.thumbUrl === 'string' && o.thumbUrl) ||
      (typeof o.thumb_url === 'string' && o.thumb_url) ||
      (typeof o.thumbPublicUrl === 'string' && o.thumbPublicUrl) ||
      null
    return { url, thumbUrl }
  }
  return { url: null, thumbUrl: null }
}

/**
 * Derive `/_storage/{bucket}/thumb_*.webp` from a main storage URL (legacy rows without thumbUrl).
 * @param {string | null | undefined} mainUrl
 * @returns {string | null}
 */
export function deriveThumbUrlFromMainUrl(mainUrl) {
  if (!mainUrl || typeof mainUrl !== 'string') return null
  const ref = parseStorageObjectRef(mainUrl)
  if (!ref?.bucket || !ref.path || isThumbStoragePath(ref.path)) return null
  const thumbPath = buildThumbStoragePath(ref.path)
  if (!thumbPath || thumbPath === ref.path) return null
  const proxy = `/_storage/${ref.bucket}/${thumbPath}`
  return toPublicImageUrl(proxy) || proxy
}

/**
 * Full-quality display URL (gallery, lightbox).
 * @param {unknown} value
 * @returns {string | null}
 */
export function resolveImageMainUrl(value) {
  const { url } = normalizeImageRef(value)
  if (!url) return null
  return toPublicImageUrl(url) || url
}

/**
 * Card / avatar / chat preview URL: explicit thumbUrl → derived thumb → main.
 * @param {unknown} value
 * @returns {string | null}
 */
export function resolveImageThumbDisplayUrl(value) {
  const main = resolveImageMainUrl(value)
  if (!main) return null

  const { thumbUrl } = normalizeImageRef(value)
  if (thumbUrl) {
    const t = toPublicImageUrl(thumbUrl) || thumbUrl
    if (t) return t
  }

  return deriveThumbUrlFromMainUrl(main) || main
}

/**
 * @param {unknown} value
 * @param {{ preferThumb?: boolean }} [opts]
 * @returns {string | null}
 */
export function resolveImageDisplaySrc(value, opts = {}) {
  const preferThumb = opts.preferThumb !== false
  if (preferThumb) {
    return resolveImageThumbDisplayUrl(value) || resolveImageMainUrl(value)
  }
  return resolveImageMainUrl(value)
}

/**
 * @param {unknown[]} urls
 * @returns {string[]}
 */
/** Alias for small circular avatars (same thumb pipeline as listing cards). */
export const resolveAvatarDisplaySrc = resolveImageThumbDisplayUrl

export function mapImagesForCardDisplay(urls) {
  if (!Array.isArray(urls)) return []
  const out = []
  const seen = new Set()
  for (const item of urls) {
    const u = resolveImageThumbDisplayUrl(item) || resolveImageMainUrl(item)
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}
