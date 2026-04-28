/**
 * SSOT запись события ленты «Моя команда».
 */

import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED = new Set([
  'teammate_joined',
  'teammate_first_stay',
  'teammate_new_listing',
  'referral_bonus_earned',
])

/**
 * @param {{
 *   referrerId: string,
 *   eventType: string,
 *   refereeId?: string | null,
 *   metadata?: Record<string, unknown>,
 *   createdAt?: string | null,
 * }} p
 */
export async function insertReferralTeamEvent(p) {
  if (!supabaseAdmin) return { success: false, error: 'NO_ADMIN' }
  const referrerId = String(p.referrerId || '').trim()
  const eventType = String(p.eventType || '').trim()
  if (!referrerId || !ALLOWED.has(eventType)) return { success: false, error: 'INVALID_EVENT' }

  const row = {
    referrer_id: referrerId,
    event_type: eventType,
    referee_id: p.refereeId ? String(p.refereeId) : null,
    metadata: p.metadata && typeof p.metadata === 'object' ? p.metadata : {},
    ...(p.createdAt ? { created_at: String(p.createdAt) } : {}),
  }

  const { error } = await supabaseAdmin.from('referral_team_events').insert(row)
  if (error) return { success: false, error: error.message || 'INSERT_FAILED' }
  return { success: true }
}
