export {
  STORAGE_BUCKETS,
  UPLOAD_API_BUCKETS,
  STORAGE_MAX_BYTES,
  LEGACY_AVATAR_PREFIX,
} from '@/lib/storage/storage-buckets'

export {
  validateStorageMime,
  validateStorageSize,
  validateStorageUpload,
  runStorageVirusScanStub,
} from '@/lib/storage/storage-validation'

export {
  resolveStorageObjectPath,
  assertStorageUploadAllowed,
  assertStorageDeleteAllowed,
} from '@/lib/storage/storage-authorization'

export {
  uploadBufferToStorage,
  createStorageSignedUrl,
  removeStorageObject,
  publicUrlToProxyPath,
  buildAvatarObjectPath,
  buildLegacyAvatarFolder,
} from '@/lib/storage/storage-upload.server'

export {
  uploadViaApi,
  uploadAvatar,
  uploadListingPhoto,
  deleteViaApi,
} from '@/lib/storage/storage-upload.client'

export {
  parseStorageObjectRef,
  storageRefKey,
  addStorageRefFromValue,
  buildThumbStoragePath,
  isThumbStoragePath,
} from '@/lib/storage/storage-path-utils'

export {
  processImageBufferToWebp,
  processImageMainAndThumb,
  processImageWithVariants,
  resolveMediaProfileId,
  isRasterImageMime,
  shouldGenerateThumb,
} from '@/lib/storage/image-processor.server'

export { normalizeUploadApiResponse } from '@/lib/storage/storage-upload.client'

export { runStorageCleanup, CLEANUP_SCAN_BUCKETS } from '@/lib/storage/storage-cleanup.service'
