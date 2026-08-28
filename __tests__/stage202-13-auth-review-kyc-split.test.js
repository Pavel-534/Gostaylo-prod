/**
 * Stage 202.13 — resend-verification route + email≠KYC flags + review draft.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  profileHasAdminKycVerified,
  profileHasEmailVerified,
} from '../lib/auth/profile-verification-flags.js'
import {
  clearReviewFormDraft,
  loadReviewFormDraft,
  reviewDraftStorageKey,
  saveReviewFormDraft,
} from '../lib/reviews/review-form-draft.js'

const root = process.cwd()

function listingQualifiesForTrustVerifiedMiniBadge(listing) {
  // Mirror Stage 202.13 gate without importing listing-card-spec-profile (@/ alias).
  if (!listing || typeof listing !== 'object') return false
  if (listing.ownerVerified === true) return true
  const own = listing.owner
  if (own && typeof own === 'object') {
    const vs = String(own.verification_status || own.verificationStatus || '')
      .trim()
      .toUpperCase()
    if (vs === 'VERIFIED') return true
  }
  return false
}

test('POST /api/v2/auth/resend-verification route exists', () => {
  const p = join(root, 'app/api/v2/auth/resend-verification/route.js')
  assert.equal(existsSync(p), true)
  const src = readFileSync(p, 'utf8')
  assert.match(src, /export async function POST/)
  assert.match(src, /sendEmailVerificationMessage/)
})

test('email verify route no longer sets verification_status VERIFIED', () => {
  const src = readFileSync(join(root, 'app/api/v2/auth/verify/route.js'), 'utf8')
  assert.match(src, /is_verified:\s*true/)
  assert.match(src, /email_verified_at/)
  assert.doesNotMatch(src, /verification_status:\s*'VERIFIED'/)
})

test('profileHasEmailVerified accepts is_verified or email_verified_at', () => {
  assert.equal(profileHasEmailVerified({ is_verified: true }), true)
  assert.equal(profileHasEmailVerified({ email_verified_at: '2026-01-01' }), true)
  assert.equal(profileHasEmailVerified({ is_verified: false }), false)
  assert.equal(profileHasEmailVerified(null), false)
})

test('profileHasAdminKycVerified requires verification_status VERIFIED', () => {
  assert.equal(profileHasAdminKycVerified({ verification_status: 'VERIFIED' }), true)
  assert.equal(profileHasAdminKycVerified({ is_verified: true, verification_status: 'PENDING' }), false)
  assert.equal(profileHasAdminKycVerified({ verification_status: 'REJECTED' }), false)
})

test('partner payout KYC reads verification_status', () => {
  const src = readFileSync(join(root, 'lib/partner/partner-payout-kyc.js'), 'utf8')
  assert.match(src, /verification_status/)
  assert.match(src, /profileHasAdminKycVerified/)
})

test('trust badge uses KYC verification_status not email is_verified', () => {
  assert.equal(
    listingQualifiesForTrustVerifiedMiniBadge({
      owner: { is_verified: true, verification_status: 'PENDING' },
    }),
    false,
  )
  assert.equal(
    listingQualifiesForTrustVerifiedMiniBadge({
      owner: { is_verified: false, verification_status: 'VERIFIED' },
    }),
    true,
  )
  assert.equal(listingQualifiesForTrustVerifiedMiniBadge({ ownerVerified: true }), true)
})

test('review form draft round-trips in sessionStorage', () => {
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
  }
  const bookingId = 'bk-draft-1'
  assert.equal(reviewDraftStorageKey(bookingId), 'airento_review_draft:bk-draft-1')
  saveReviewFormDraft(bookingId, {
    ratings: { cleanliness: 4, accuracy: 0, communication: 0, location: 0, value: 0 },
    comment: 'Nice stay',
  })
  const loaded = loadReviewFormDraft(bookingId)
  assert.equal(loaded.comment, 'Nice stay')
  assert.equal(loaded.ratings.cleanliness, 4)
  clearReviewFormDraft(bookingId)
  assert.equal(loadReviewFormDraft(bookingId), null)
  delete globalThis.sessionStorage
})
