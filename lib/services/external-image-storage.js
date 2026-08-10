/**
 * Скачивание внешних URL (Airbnb/Booking и т.д.) и загрузка в Supabase Storage bucket listing-images.
 * Service Role на сервере; клиенту отдаём same-origin proxy URL как в /api/v2/upload.
 * ADR-210 Slice 4: opts.pathMode='concierge' → concierge/{listingId}/{hash}.{ext}; MIME allowlist.
 */

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { isHostedListingImageUrl } from '@/lib/listing-image-host-utils'
import { getImageImporterUserAgent } from '@/lib/http-client-identity'

const BUCKET = 'listing-images'
const MAX_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 25000

/** ADR-210 Concierge rehost allowlist */
export const CONCIERGE_IMAGE_MIME_ALLOWLIST = Object.freeze([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export { isHostedListingImageUrl } from '@/lib/listing-image-host-utils'

function publicUrlToProxyUrl(publicUrl) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!publicUrl || !supabaseUrl) return publicUrl
  const base = supabaseUrl.replace(/\/$/, '')
  const prefix = `${base}/storage/v1/object/public/`
  if (publicUrl.startsWith(prefix)) {
    return `/_storage/${publicUrl.slice(prefix.length)}`
  }
  return publicUrl
}

function extFromContentType(ct) {
  if (!ct || typeof ct !== 'string') return 'jpg'
  const s = ct.split(';')[0].trim().toLowerCase()
  if (s.includes('jpeg') || s === 'image/jpg') return 'jpg'
  if (s.includes('png')) return 'png'
  if (s.includes('webp')) return 'webp'
  if (s.includes('gif')) return 'gif'
  return 'jpg'
}

function extFromUrlPath(urlString) {
  try {
    const p = new URL(urlString).pathname
    const m = p.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)
    return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : null
  } catch {
    return null
  }
}

function normalizeMime(ct) {
  return String(ct || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
}

/**
 * Скачать изображение по URL и загрузить в listing-images/{listingId}/...
 *
 * @param {string} url — внешний HTTPS URL
 * @param {string} listingId — id объявления (префикс пути в бакете)
 * @param {{
 *   pathMode?: 'default'|'concierge',
 *   allowedContentTypes?: string[]|null,
 *   fetchImpl?: typeof fetch,
 *   storageClient?: import('@supabase/supabase-js').SupabaseClient,
 *   timeoutMs?: number,
 * }} [opts]
 * @returns {Promise<{ success: true, url: string, publicUrl: string, path: string } | { success: false, error: string, status?: number }>}
 */
export async function uploadExternalImageToStorage(url, listingId, opts = {}) {
  const client = opts.storageClient || supabaseAdmin
  if (!client) {
    return { success: false, error: 'Supabase admin not configured' }
  }
  if (!url || typeof url !== 'string' || !listingId) {
    return { success: false, error: 'Invalid url or listingId' }
  }
  if (isHostedListingImageUrl(url)) {
    return { success: false, error: 'URL is already on our storage' }
  }
  if (!/^https?:\/\//i.test(url.trim())) {
    return { success: false, error: 'Only http(s) URLs are supported' }
  }

  const fetchImpl = opts.fetchImpl || fetch
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : FETCH_TIMEOUT_MS

  let response
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    response = await fetchImpl(url.trim(), {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': getImageImporterUserAgent(),
      },
    })
    clearTimeout(t)
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Download timeout' : e?.message || 'Download failed'
    return { success: false, error: msg }
  }

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}`,
      status: response.status,
    }
  }

  const lenHeader = response.headers.get('content-length')
  if (lenHeader) {
    const n = parseInt(lenHeader, 10)
    if (Number.isFinite(n) && n > MAX_BYTES) {
      return { success: false, error: 'Image too large' }
    }
  }

  const buf = Buffer.from(await response.arrayBuffer())
  if (buf.length > MAX_BYTES) {
    return { success: false, error: 'Image too large' }
  }
  if (buf.length < 64) {
    return { success: false, error: 'Empty or invalid response' }
  }

  const ct = response.headers.get('content-type') || ''
  const mimeNorm = normalizeMime(ct)
  const allowlist = Array.isArray(opts.allowedContentTypes) ? opts.allowedContentTypes : null

  if (allowlist && allowlist.length > 0) {
    const allowed = allowlist.map((m) => normalizeMime(m))
    // octet-stream: fall back to URL extension only if ext maps to allowlist
    if (mimeNorm && mimeNorm !== 'application/octet-stream') {
      if (!allowed.includes(mimeNorm) && !(mimeNorm === 'image/jpg' && allowed.includes('image/jpeg'))) {
        return { success: false, error: `MIME not allowed: ${mimeNorm || 'unknown'}` }
      }
    }
  } else if (ct && !mimeNorm.startsWith('image/') && !mimeNorm.includes('octet-stream')) {
    return { success: false, error: 'Not an image content-type' }
  }

  const ext = extFromContentType(ct) || extFromUrlPath(url) || 'jpg'
  if (allowlist && allowlist.length > 0) {
    const extOk = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp'
    if (!extOk) {
      return { success: false, error: `Extension not allowed: ${ext}` }
    }
  }

  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg'

  const safeListing = String(listingId).replace(/[^a-zA-Z0-9-_]/g, '')
  let objectPath
  if (opts.pathMode === 'concierge') {
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 20)
    objectPath = `concierge/${safeListing}/${hash}.${ext === 'jpeg' ? 'jpg' : ext}`
  } else {
    objectPath = `${safeListing}/import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  }

  const { data, error } = await client.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: mime,
    upsert: opts.pathMode === 'concierge',
  })

  if (error) {
    console.error('[external-image-storage] upload error:', error.message)
    return { success: false, error: error.message }
  }

  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(data.path)
  const proxyUrl = publicUrlToProxyUrl(urlData.publicUrl)

  return {
    success: true,
    url: proxyUrl,
    publicUrl: urlData.publicUrl,
    path: data.path,
  }
}

/**
 * Пройти по массиву URL: внешние — в Storage, при ошибке оставить исходную ссылку.
 *
 * @param {string} listingId
 * @param {string[]} imageUrls
 * @returns {Promise<{ images: string[], migrated: number, failed: number, details: Array<{ url: string, ok: boolean, error?: string }> }>}
 */
export async function migrateListingExternalImages(listingId, imageUrls) {
  const input = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string' && u.trim()) : []
  const images = []
  const details = []
  let migrated = 0
  let failed = 0

  for (const original of input) {
    if (isHostedListingImageUrl(original)) {
      images.push(original)
      details.push({ url: original, ok: true, skipped: true })
      continue
    }

    const result = await uploadExternalImageToStorage(original, listingId)
    if (result.success && result.url) {
      images.push(result.url)
      migrated += 1
      details.push({ url: original, ok: true, storedAs: result.url })
    } else {
      images.push(original)
      failed += 1
      details.push({
        url: original,
        ok: false,
        error: result.error,
        status: result.status,
      })
    }
  }

  return { images, migrated, failed, details }
}
