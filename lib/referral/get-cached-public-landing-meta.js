/**
 * Stage 202.6 — shared cached loader for referral landing-meta (API + RSC metadata).
 * Avoids generateMetadata → HTTP self-fetch (double serverless invocation).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { buildPublicLandingPayload } from '@/lib/referral/build-public-landing-payload.js'

const loadLandingCached = unstable_cache(
  async (userId) => buildPublicLandingPayload(supabaseAdmin, userId),
  ['referral-landing-meta-v1'],
  { revalidate: 60 },
)

/**
 * @param {string | null | undefined} userId
 * @returns {Promise<object | null>}
 */
export async function getCachedPublicLandingMeta(userId) {
  const uid = String(userId || '').trim()
  if (!uid || !supabaseAdmin) return null
  try {
    const data = await loadLandingCached(uid)
    return data || null
  } catch {
    return null
  }
}
