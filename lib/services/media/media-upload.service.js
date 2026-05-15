/**
 * Серверный медиа-пайплайн — re-export SSOT **`lib/storage/image-processor.server.js`**.
 * Клиент: `compress-image-browser.js` + `POST /api/v2/upload` only.
 */

export {
  MEDIA_PROFILE_IDS,
  MEDIA_PROFILES,
  logMediaProfile,
  resolveMediaProfileId,
  isRasterImageMime,
  processImageBufferToWebp,
  processImageMainAndThumb,
  processImageWithVariants,
  compressImageBufferTelegramListing,
  buildThumbStoragePath,
  buildVariantStoragePath,
  shouldGenerateThumb,
  THUMB_ENABLED_PROFILES,
  THUMBNAIL_PROFILE,
  MEDIA_VARIANTS,
} from '@/lib/storage/image-processor.server'
