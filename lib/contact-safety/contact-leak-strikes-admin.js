/**
 * SSOT: админское управление profiles.contact_leak_strikes.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { incrementContactLeakStrikes } from '@/lib/contact-leak-strikes'

/**
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, strikes?: number, error?: string }>}
 */
export async function getContactLeakStrikes(userId) {
  if (!supabaseAdmin || !userId) return { ok: false, error: 'NOT_CONFIGURED' }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('contact_leak_strikes')
    .eq('id', userId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, strikes: Number(data?.contact_leak_strikes) || 0 }
}

/**
 * @param {string} userId
 * @param {number} strikes
 */
export async function setContactLeakStrikes(userId, strikes) {
  if (!supabaseAdmin || !userId) return { ok: false, error: 'NOT_CONFIGURED' }
  const value = Math.max(0, Math.min(9999, Math.floor(Number(strikes) || 0)))
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ contact_leak_strikes: value })
    .eq('id', userId)
    .select('contact_leak_strikes')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, strikes: Number(data?.contact_leak_strikes) || value }
}

/**
 * @param {string} userId
 */
export async function resetContactLeakStrikes(userId) {
  return setContactLeakStrikes(userId, 0)
}

/**
 * @param {string} userId
 * @param {number} [delta]
 */
export async function adjustContactLeakStrikes(userId, delta = 1) {
  const d = Math.floor(Number(delta) || 0)
  if (d === 0) return getContactLeakStrikes(userId)
  if (d > 0) {
    for (let i = 0; i < d; i++) {
      const ok = await incrementContactLeakStrikes(userId)
      if (!ok) return { ok: false, error: 'RPC_FAILED' }
    }
    return getContactLeakStrikes(userId)
  }
  const cur = await getContactLeakStrikes(userId)
  if (!cur.ok) return cur
  return setContactLeakStrikes(userId, Math.max(0, (cur.strikes || 0) + d))
}
