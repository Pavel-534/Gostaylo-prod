/**
 * Stage 168.1 — assemble portable JSON export for authenticated user (DSAR).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { normalizeNotificationPreferences } from '@/lib/privacy/notification-preferences'
import { getSiteDisplayName } from '@/lib/site-url.js'

const EXPORT_VERSION = '168.1'

function pickProfileExport(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    avatar: row.avatar,
    preferred_currency: row.preferred_currency,
    preferred_payout_currency: row.preferred_payout_currency,
    preferred_language: row.preferred_language,
    referral_code: row.referral_code,
    is_verified: row.is_verified,
    verification_status: row.verification_status,
    notification_preferences: normalizeNotificationPreferences(row.notification_preferences),
    quiet_mode_enabled: row.quiet_mode_enabled,
    quiet_hour_start: row.quiet_hour_start,
    quiet_hour_end: row.quiet_hour_end,
    terms_accepted_at: row.terms_accepted_at ?? row.legal_terms_accepted_at,
    legal_terms_accepted_at: row.legal_terms_accepted_at,
    partner_terms_accepted_at: row.partner_terms_accepted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * @param {string} userId
 */
export async function buildUserDataExport(userId) {
  if (!supabaseAdmin) {
    throw new Error('Database not configured')
  }

  const uid = String(userId)

  const [
    profileRes,
    renterBookingsRes,
    partnerBookingsRes,
    favoritesRes,
    listingViewsRes,
    reviewsRes,
    guestReviewsRes,
    listingsRes,
    walletRes,
    walletTxRes,
    erasureRes,
    pushTokensRes,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabaseAdmin.from('bookings').select('*').eq('renter_id', uid).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('bookings').select('*').eq('partner_id', uid).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('favorites').select('id, listing_id, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('listing_views').select('listing_id, viewed_at').eq('user_id', uid).order('viewed_at', { ascending: false }).limit(500),
    supabaseAdmin.from('reviews').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('guest_reviews').select('*').eq('guest_id', uid).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('listings').select('id, title, status, district, created_at, updated_at').eq('owner_id', uid).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('user_wallets').select('*').eq('user_id', uid).maybeSingle(),
    supabaseAdmin
      .from('wallet_transactions')
      .select('id, type, amount_thb, currency, status, description, created_at, metadata')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('data_erasure_requests')
      .select('id, status, requested_at, scheduled_for, completed_at, cancelled_at, reason')
      .eq('user_id', uid)
      .order('requested_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('user_push_tokens')
      .select('id, platform, created_at, updated_at, last_used_at')
      .eq('user_id', uid)
      .limit(50),
  ])

  const profile = profileRes.data
  if (!profile) {
    return { ok: false, error: 'PROFILE_NOT_FOUND' }
  }

  const listingViews = (listingViewsRes.data || []).map((row) => ({
    listing_id: row.listing_id,
    viewed_at: row.viewed_at,
  }))

  return {
    ok: true,
    export: {
      schema_version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      platform: getSiteDisplayName(),
      subject_id: uid,
      profile: pickProfileExport(profile),
      bookings_as_renter: renterBookingsRes.data || [],
      bookings_as_partner: partnerBookingsRes.data || [],
      favorites: favoritesRes.data || [],
      listing_views_anonymized: listingViews,
      reviews: reviewsRes.data || [],
      guest_reviews: guestReviewsRes.data || [],
      owned_listings_summary: listingsRes.data || [],
      wallet: walletRes.data || null,
      wallet_transactions: walletTxRes.data || [],
      push_tokens_summary: (pushTokensRes.data || []).map((t) => ({
        id: t.id,
        platform: t.platform,
        created_at: t.created_at,
        last_used_at: t.last_used_at,
      })),
      erasure_requests: erasureRes.data || [],
      notes: {
        ledger_retention:
          'Financial ledger journals linked to your bookings are retained pseudonymized for legal and tax compliance.',
        listing_views:
          'Listing views contain only listing_id and timestamp (no listing titles in this section).',
      },
    },
  }
}
