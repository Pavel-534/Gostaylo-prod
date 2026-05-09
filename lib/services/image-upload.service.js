/**
 * GoStayLo - Image Upload Service
 *
 * Клиентское сжатие — SSOT: `lib/services/media/media-upload.service.js` (профиль listing_photo).
 * Загрузка только через POST /api/v2/upload (service role на сервере).
 */

import { compressImageForBrowser } from '@/lib/services/media/media-upload.service';

const BUCKET_NAME = 'listing-images';
export const REVIEW_IMAGES_BUCKET = 'review-images';

/** @deprecated Используйте `compressImageForBrowser` из `@/lib/services/media/media-upload.service` с нужным профилем. */
export async function compressImage(file, onProgress) {
  return compressImageForBrowser(file, 'listing_photo', (p0_100) => {
    if (onProgress) onProgress(Math.round((p0_100 / 100) * 50))
  })
}

function objectPathWithinBucket(fileUrl) {
  const m = fileUrl.match(/listing-images\/(.+)$/);
  return m ? m[1] : null;
}

/**
 * Загрузка в Storage через API (без service key в браузере)
 */
export async function uploadToStorage(file, listingId, onProgress) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = file.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${listingId}/${timestamp}-${randomStr}.${extension}`;

  try {
    const formData = new FormData();
    formData.append('file', file, `upload.${extension}`);
    formData.append('bucket', BUCKET_NAME);
    formData.append('profile', 'listing_photo');
    formData.append('objectPath', objectPath);
    formData.append('upsert', 'true');

    const response = await fetch('/api/v2/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Upload failed');
    }

    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      url: json.url,
      fileName: json.filename,
      size: file.size,
    };
  } catch (error) {
    console.error('[IMAGE] Upload failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function deleteFromStorage(fileUrl) {
  try {
    const path = objectPathWithinBucket(fileUrl);
    if (!path) {
      throw new Error('Invalid file URL');
    }

    const response = await fetch('/api/v2/upload', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: BUCKET_NAME, path }),
    });

    return response.ok;
  } catch (error) {
    console.error('[IMAGE] Delete failed:', error);
    return false;
  }
}

export async function processAndUploadImages(files, listingId, onProgress) {
  const urls = [];
  const total = files.length;
  let completed = 0;

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      console.warn(`[IMAGE] Skipping non-image file: ${file.name}`);
      continue;
    }

    if (file.size > 10 * 1024 * 1024) {
      console.warn(`[IMAGE] File too large: ${file.name}`);
      continue;
    }

    try {
      const compressedFile = await compressImage(file, (p) => {
        if (onProgress) {
          const fileContribution = 100 / total;
          const progress = (completed * fileContribution) + (p * 0.5 * fileContribution / 100);
          onProgress(Math.min(99, Math.round(progress)));
        }
      });

      const result = await uploadToStorage(compressedFile, listingId, (p) => {
        if (onProgress) {
          const fileContribution = 100 / total;
          const progress = (completed * fileContribution) + (0.5 * fileContribution) + (p * 0.5 * fileContribution / 100);
          onProgress(Math.min(99, Math.round(progress)));
        }
      });

      if (result.success) {
        urls.push(result.url);
      }

      completed++;

      if (onProgress) {
        onProgress(completed === total ? 100 : Math.min(99, Math.round((completed / total) * 100)));
      }
    } catch (error) {
      console.error(`[IMAGE] Failed to process ${file.name}:`, error);
    }
  }

  return urls;
}

/**
 * Upload one compressed image to `review-images` (path: userId/bookingId/…).
 */
export async function uploadReviewPhotoToStorage(file, userId, bookingId, onProgress) {
  const safeUser = String(userId || '').replace(/\//g, '') || 'user';
  const safeBooking = String(bookingId || '').replace(/\//g, '') || 'booking';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = file.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${safeUser}/${safeBooking}/${timestamp}-${randomStr}.${extension}`;

  try {
    const formData = new FormData();
    formData.append('file', file, `upload.${extension}`);
    formData.append('bucket', REVIEW_IMAGES_BUCKET);
    formData.append('profile', 'listing_photo');
    formData.append('objectPath', objectPath);
    formData.append('upsert', 'true');

    const response = await fetch('/api/v2/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Upload failed');
    }

    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      url: json.url,
      fileName: json.filename,
      size: file.size,
    };
  } catch (error) {
    console.error('[IMAGE] Review upload failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function processAndUploadReviewPhotos(files, userId, bookingId, onProgress) {
  const urls = [];
  const list = Array.isArray(files) ? files : [];
  const total = list.length;
  let completed = 0;

  for (const file of list) {
    if (!file.type.startsWith('image/')) {
      console.warn(`[IMAGE] Skipping non-image file: ${file.name}`);
      continue;
    }

    if (file.size > 10 * 1024 * 1024) {
      console.warn(`[IMAGE] File too large: ${file.name}`);
      continue;
    }

    try {
      const compressedFile = await compressImage(file, (p) => {
        if (onProgress) {
          const fileContribution = 100 / total;
          const progress = completed * fileContribution + (p * 0.5 * fileContribution) / 100;
          onProgress(Math.min(99, Math.round(progress)));
        }
      });

      const result = await uploadReviewPhotoToStorage(compressedFile, userId, bookingId, (p) => {
        if (onProgress) {
          const fileContribution = 100 / total;
          const progress =
            completed * fileContribution + 0.5 * fileContribution + (p * 0.5 * fileContribution) / 100;
          onProgress(Math.min(99, Math.round(progress)));
        }
      });

      if (result.success) {
        urls.push(result.url);
      }

      completed++;

      if (onProgress) {
        onProgress(completed === total ? 100 : Math.min(99, Math.round((completed / total) * 100)));
      }
    } catch (error) {
      console.error(`[IMAGE] Failed to process review photo ${file.name}:`, error);
    }
  }

  return urls;
}

export default {
  compressImage,
  uploadToStorage,
  deleteFromStorage,
  processAndUploadImages,
  REVIEW_IMAGES_BUCKET,
  uploadReviewPhotoToStorage,
  processAndUploadReviewPhotos,
};
