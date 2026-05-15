/**
 * Server-side upload validation (Stage 95.0). MIME rules mirror storage bucket intent.
 */

import { STORAGE_MAX_BYTES, STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'

const CHAT_IMAGE_AND_DOC = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const IMAGE_ONLY = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const DISPUTE_EVIDENCE = new Set([
  ...IMAGE_ONLY,
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

const KYC_TYPES = new Set([...IMAGE_ONLY, 'application/pdf'])

/**
 * @param {string} bucket
 * @param {string} mime
 * @param {string} fileName
 */
export function validateStorageMime(bucket, mime, fileName = '') {
  const type = String(mime || '').trim().toLowerCase()
  const nameLower = String(fileName || '').toLowerCase()
  const looksLikeAudio =
    type.startsWith('audio/') || /\.(webm|ogg|oga|opus|mp3|m4a|wav|mp4|aac)$/i.test(nameLower)

  switch (bucket) {
    case STORAGE_BUCKETS.CHAT_ATTACHMENTS:
      return CHAT_IMAGE_AND_DOC.has(type) || looksLikeAudio
    case STORAGE_BUCKETS.DISPUTE_EVIDENCE:
      return DISPUTE_EVIDENCE.has(type)
    case STORAGE_BUCKETS.REVIEW_IMAGES:
    case STORAGE_BUCKETS.AVATARS:
      return IMAGE_ONLY.has(type)
    case STORAGE_BUCKETS.VERIFICATION_DOCUMENTS:
      return KYC_TYPES.has(type)
    case STORAGE_BUCKETS.LISTING_IMAGES:
    case STORAGE_BUCKETS.LISTINGS_LEGACY:
      return KYC_TYPES.has(type)
    default:
      return false
  }
}

/**
 * @param {number} sizeBytes
 * @param {number} [maxBytes]
 */
export function validateStorageSize(sizeBytes, maxBytes = STORAGE_MAX_BYTES) {
  const n = Number(sizeBytes)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Empty file' }
  if (n > maxBytes) {
    return {
      ok: false,
      error: `Файл слишком большой (макс. ${Math.round(maxBytes / (1024 * 1024))}MB)`,
    }
  }
  return { ok: true }
}

/** Placeholder for future ClamAV / vendor scan hook. */
export async function runStorageVirusScanStub(_buffer, _meta) {
  return { ok: true, skipped: true, reason: 'stub' }
}

/**
 * @param {string} bucket
 * @param {{ size: number, type?: string, name?: string }} fileMeta
 */
export async function validateStorageUpload(bucket, fileMeta) {
  const sizeCheck = validateStorageSize(fileMeta.size)
  if (!sizeCheck.ok) return sizeCheck

  if (!validateStorageMime(bucket, fileMeta.type, fileMeta.name)) {
    return { ok: false, error: mimeErrorMessage(bucket) }
  }

  const scan = await runStorageVirusScanStub(null, { bucket })
  if (!scan.ok) return { ok: false, error: 'File rejected by security scan' }

  return { ok: true }
}

function mimeErrorMessage(bucket) {
  switch (bucket) {
    case STORAGE_BUCKETS.CHAT_ATTACHMENTS:
      return 'Для чата: изображения, PDF или голосовые (audio/*)'
    case STORAGE_BUCKETS.DISPUTE_EVIDENCE:
      return 'Для спора: JPG, PNG, WebP, GIF или видео MP4/MOV/WebM'
    case STORAGE_BUCKETS.AVATARS:
      return 'Для аватара: только JPG, PNG, WebP или GIF'
    case STORAGE_BUCKETS.REVIEW_IMAGES:
      return 'Для отзыва: только изображения JPG, PNG, WebP или GIF'
    default:
      return 'Неподдерживаемый формат файла. Используйте JPG, PNG, WebP или PDF'
  }
}
