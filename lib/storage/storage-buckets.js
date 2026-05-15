/**
 * SSOT: Supabase Storage bucket ids and defaults (Stage 95.0).
 * Uploads go through POST /api/v2/upload (service_role on server); policies defend direct PostgREST access.
 */

export const STORAGE_BUCKETS = Object.freeze({
  AVATARS: 'avatars',
  LISTING_IMAGES: 'listing-images',
  LISTINGS_LEGACY: 'listings',
  VERIFICATION_DOCUMENTS: 'verification_documents',
  CHAT_ATTACHMENTS: 'chat-attachments',
  REVIEW_IMAGES: 'review-images',
  DISPUTE_EVIDENCE: 'dispute-evidence',
})

/** Buckets allowed via POST /api/v2/upload */
export const UPLOAD_API_BUCKETS = Object.freeze([
  STORAGE_BUCKETS.VERIFICATION_DOCUMENTS,
  STORAGE_BUCKETS.LISTING_IMAGES,
  STORAGE_BUCKETS.CHAT_ATTACHMENTS,
  STORAGE_BUCKETS.REVIEW_IMAGES,
  STORAGE_BUCKETS.DISPUTE_EVIDENCE,
  STORAGE_BUCKETS.AVATARS,
])

export const STORAGE_MAX_BYTES = 10 * 1024 * 1024

/** Legacy avatar paths live under listing-images/avatars/{profileId}/ */
export const LEGACY_AVATAR_PREFIX = 'avatars/'
