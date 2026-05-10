/**
 * Канонические профили медиа и чистые хелперы — без sharp и без browser-image-compression.
 * Импортируйте из клиентских компонентов и с сервера; не тянет Node builtins.
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
