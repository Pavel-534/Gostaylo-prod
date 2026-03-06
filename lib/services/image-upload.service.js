/**
 * Gostaylo - Image Upload Service
 * 
 * Features:
 * - Client-side image compression (max 1920px, 80% quality)
 * - WebP/JPEG conversion for smaller file sizes
 * - Upload to Supabase Storage
 * - Progress callback support
 */

import imageCompression from 'browser-image-compression';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'listing-images';

// Compression options
const compressionOptions = {
  maxSizeMB: 1,           // Max file size 1MB
  maxWidthOrHeight: 1920, // Max dimension 1920px
  useWebWorker: true,
  fileType: 'image/webp', // Convert to WebP for better compression
  initialQuality: 0.8,    // 80% quality
};

/**
 * Compress image on client side
 */
export async function compressImage(file, onProgress) {
  try {
    const options = {
      ...compressionOptions,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress(Math.round(progress * 50)); // 0-50% for compression
        }
      }
    };

    const compressedFile = await imageCompression(file, options);
    
    console.log(`[IMAGE] Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
    
    return compressedFile;
  } catch (error) {
    console.error('[IMAGE] Compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadToStorage(file, listingId, onProgress) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = file.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${listingId}/${timestamp}-${randomStr}.${extension}`;

  try {
    // Upload file
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': file.type,
          'x-upsert': 'true'
        },
        body: file
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    // Get public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
    
    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      url: publicUrl,
      fileName,
      size: file.size
    };
  } catch (error) {
    console.error('[IMAGE] Upload failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteFromStorage(fileUrl) {
  try {
    // Extract file path from URL
    const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/listing-images\/(.+)$/);
    if (!pathMatch) {
      throw new Error('Invalid file URL');
    }
    
    const filePath = pathMatch[1];
    
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[IMAGE] Delete failed:', error);
    return false;
  }
}

/**
 * Process and upload multiple images
 * @param {File[]} files - Array of File objects
 * @param {string} listingId - Listing ID for folder organization
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string[]>} - Array of public URLs
 */
export async function processAndUploadImages(files, listingId, onProgress) {
  const urls = [];
  const total = files.length;
  let completed = 0;

  for (const file of files) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.warn(`[IMAGE] Skipping non-image file: ${file.name}`);
      continue;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      console.warn(`[IMAGE] File too large: ${file.name}`);
      continue;
    }

    try {
      // Step 1: Compress
      const compressedFile = await compressImage(file, (p) => {
        if (onProgress) {
          // Each file contributes (100 / total)% to overall progress
          // Compression is first 50% of that file's contribution
          const fileContribution = 100 / total;
          const progress = (completed * fileContribution) + (p * 0.5 * fileContribution / 100);
          onProgress(Math.min(99, Math.round(progress)));
        }
      });

      // Step 2: Upload
      const result = await uploadToStorage(compressedFile, listingId, (p) => {
        if (onProgress) {
          // Upload is second 50% of that file's contribution
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
        // Show 100% only when all files are done
        onProgress(completed === total ? 100 : Math.min(99, Math.round((completed / total) * 100)));
      }
    } catch (error) {
      console.error(`[IMAGE] Failed to process ${file.name}:`, error);
    }
  }

  return urls;
}

export default {
  compressImage,
  uploadToStorage,
  deleteFromStorage,
  processAndUploadImages
};
