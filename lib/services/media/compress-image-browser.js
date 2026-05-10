/**
 * Клиентское сжатие изображений (browser-image-compression).
 * Не импортируйте этот файл из API routes / server-only кода, если хотите избежать дублирования worker —
 * для сервера используйте processImageBufferToWebp в media-upload.service.js.
 */

import { MEDIA_PROFILE_IDS, MEDIA_PROFILES } from '@/lib/services/media/media-profiles'

/**
 * Клиент: сжатие в WebP через browser-image-compression.
 * @param {File|Blob} file
 * @param {string} [profileId]
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
