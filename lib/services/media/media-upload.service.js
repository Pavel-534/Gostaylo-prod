/**
 * SSOT: медиа-пайплайн (профили сжатия, клиентский browser-image-compression, серверный sharp).
 * Не импортируйте sharp / browser-image-compression на верхнем уровне — только внутри async-функций ниже.
 */

/** @typedef {'listing_photo' | 'dispute_media' | 'chat_image' | 'kyc_document'} MediaProfileId */

export const MEDIA_PROFILE_IDS = ['listing_photo', 'dispute_media', 'chat_image', 'kyc_document']

/**
 * Канонические профили: maxDimension = длинная сторона (fit inside), quality 0–1, выход webp.
 * maxSizeMB — подсказка для browser-image-compression на клиенте.
 */
export const MEDIA_PROFILES = Object.freeze({
  listing_photo: {
    maxDimension: 1920,
    quality: 0.8,
    format: 'webp',
    maxSizeMB: 1,
  },
  dispute_media: {
    maxDimension: 1920,
    quality: 0.8,
    format: 'webp',
    maxSizeMB: 2,
  },
  chat_image: {
    maxDimension: 1600,
    quality: 0.82,
    format: 'webp',
    maxSizeMB: 1.5,
  },
  kyc_document: {
    maxDimension: 1920,
    quality: 0.85,
    format: 'webp',
    maxSizeMB: 1.2,
  },
})

const BUCKET_DEFAULT_PROFILE = Object.freeze({
  'listing-images': 'listing_photo',
  'review-images': 'listing_photo',
  'dispute-evidence': 'dispute_media',
  'chat-attachments': 'chat_image',
  verification_documents: 'kyc_document',
  /** bucket id `avatars` (если используется отдельный бакет) */
  avatars: 'listing_photo',
})

export function logMediaProfile(profileId) {
  const id = String(profileId || '').trim()
  if (!id) return
  console.log(`[MEDIA_PROFILE]: ${id}`)
}

/**
 * @param {string} bucket
 * @param {string} [explicit] — из formData profile / mediaProfile
 * @returns {MediaProfileId | null}
 */
export function resolveMediaProfileId(bucket, explicit) {
  const hint = String(explicit || '').trim()
  if (hint && MEDIA_PROFILE_IDS.includes(hint)) return /** @type {MediaProfileId} */ (hint)
  return BUCKET_DEFAULT_PROFILE[bucket] ? /** @type {MediaProfileId} */ (BUCKET_DEFAULT_PROFILE[bucket]) : null
}

export function isRasterImageMime(mime) {
  const m = String(mime || '').trim().toLowerCase()
  return (
    m === 'image/jpeg' ||
    m === 'image/png' ||
    m === 'image/webp' ||
    m === 'image/gif' ||
    m === 'image/jpg'
  )
}

/**
 * Клиент: сжатие в WebP через browser-image-compression (аналог legacy compressImage из image-upload.service).
 * @param {File|Blob} file
 * @param {MediaProfileId} [profileId]
 * @param {(n: number) => void} [onProgress] 0–100
 */
export async function compressImageForBrowser(file, profileId = 'listing_photo', onProgress) {
  if (typeof window === 'undefined') {
    throw new Error('compressImageForBrowser is client-only')
  }
  const id = MEDIA_PROFILE_IDS.includes(profileId) ? profileId : 'listing_photo'
  const profile = MEDIA_PROFILES[id]
  const imageCompression = (await import('browser-image-compression')).default
  const options = {
    maxSizeMB: profile.maxSizeMB,
    maxWidthOrHeight: profile.maxDimension,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: profile.quality,
    onProgress: (progress) => {
      if (onProgress) onProgress(Math.round(Number(progress) * 100))
    },
  }
  try {
    const out = await imageCompression(file, options)
    console.log(
      `[IMAGE] Compressed (${id}): ${(file.size / 1024).toFixed(1)}KB → ${(out.size / 1024).toFixed(1)}KB`,
    )
    return out
  } catch (error) {
    console.error('[IMAGE] Compression failed:', error)
    return file
  }
}

/**
 * Сервер: ресайз + WebP через sharp.
 * @param {Buffer} buffer
 * @param {MediaProfileId} profileId
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function processImageBufferToWebp(buffer, profileId) {
  const id = MEDIA_PROFILE_IDS.includes(profileId) ? profileId : 'listing_photo'
  const profile = MEDIA_PROFILES[id]
  try {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default || sharpMod
    const out = await sharp(Buffer.from(buffer))
      .rotate()
      .resize(profile.maxDimension, profile.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: Math.min(100, Math.max(1, Math.round(profile.quality * 100))) })
      .toBuffer()
    const startSize = buffer.length
    const endSize = out.length
    const ratio = startSize ? ((1 - endSize / startSize) * 100).toFixed(1) : '0'
    console.log(`[MEDIA_PIPELINE] sharp ${id}: ${(startSize / 1024).toFixed(1)}KB → ${(endSize / 1024).toFixed(1)}KB (-${ratio}%)`)
    return { ok: true, buffer: out }
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[MEDIA_PIPELINE] sharp failed:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Совместимость с Telegram-ingest (`lib/services/telegram/storage.js`): вход ArrayBuffer или Buffer → WebP buffer.
 */
export async function compressImageBufferTelegramListing(inputBuffer) {
  const buf = Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer)
  const res = await processImageBufferToWebp(buf, 'listing_photo')
  if (!res.ok) return buf
  return res.buffer
}
