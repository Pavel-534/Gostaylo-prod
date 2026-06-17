/**
 * Stage 154.1 — KYC bucket access (private storage + signed URLs only).
 */

import { STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'
import { createStorageSignedUrl } from '@/lib/storage/storage-upload.server'

/** Signed URL TTL for verification documents (15 minutes). */
export const VERIFICATION_DOC_SIGNED_URL_TTL_SEC = 15 * 60

/**
 * @param {string | null | undefined} path
 */
export function isSafeVerificationDocObjectPath(path) {
  const p = String(path || '').trim()
  if (!p || p.includes('..') || p.startsWith('/')) return false
  return /^[\w.-]+(?:\/[\w.-]+)*$/.test(p)
}

/**
 * Object path must start with `{profileId}/…`.
 * @param {string} path
 * @param {string} userId
 */
export function verificationDocPathOwnedByUser(path, userId) {
  if (!isSafeVerificationDocObjectPath(path)) return false
  const owner = String(path).split('/')[0]
  return owner === String(userId || '').trim()
}

/**
 * @param {string} objectPath
 * @param {number} [expiresInSec]
 */
export async function createVerificationDocSignedUrl(objectPath, expiresInSec = VERIFICATION_DOC_SIGNED_URL_TTL_SEC) {
  return createStorageSignedUrl(STORAGE_BUCKETS.VERIFICATION_DOCUMENTS, objectPath, expiresInSec)
}
