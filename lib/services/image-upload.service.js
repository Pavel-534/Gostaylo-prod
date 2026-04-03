/**
 * GoStayLo - Image Upload Service
 *
 * Сжатие на клиенте; загрузка только через POST /api/v2/upload (service role на сервере).
 */

import imageCompression from 'browser-image-compression';

const BUCKET_NAME = 'listing-images';
export const REVIEW_IMAGES_BUCKET = 'review-images';

const compressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.8,
};

export async function compressImage(file, onProgress) {
  try {
    const options = {
      ...compressionOptions,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress(Math.round(progress * 50));
        }
      },
    };

    const compressedFile = await imageCompression(file, options);

    console.log(`[IMAGE] Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);

    return compressedFile;
  } catch (error) {
    console.error('[IMAGE] Compression failed:', error);
    return file;
  }
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
