/**
 * Admin blacklist — `blacklist` table (WALLET | PHONE | EMAIL | IP).
 * @see app/admin/security/page.js
 */

import { supabaseAdmin } from '@/lib/supabase'

function isMissingTableError(message) {
  return /relation .*blacklist|does not exist/i.test(String(message || ''))
}

function mapRow(row) {
  const type = String(row?.blacklist_type || '').toUpperCase()
  const base = {
    id: row.id,
    reason: row.reason || '',
    addedAt: row.created_at,
  }
  if (type === 'WALLET') {
    return { kind: 'wallet', item: { ...base, address: row.value } }
  }
  if (type === 'PHONE') {
    return { kind: 'phone', item: { ...base, number: row.value } }
  }
  return null
}

/**
 * @returns {Promise<{ wallets: object[], phones: object[] } | { error: string, status: number }>}
 */
export async function listAdminBlacklist() {
  if (!supabaseAdmin) {
    return { error: 'Database not configured', status: 500 }
  }

  const { data, error } = await supabaseAdmin
    .from('blacklist')
    .select('id, blacklist_type, value, reason, created_at, added_by')
    .in('blacklist_type', ['WALLET', 'PHONE'])
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error.message)) {
      return { wallets: [], phones: [] }
    }
    return { error: error.message, status: 500 }
  }

  const wallets = []
  const phones = []
  for (const row of data || []) {
    const mapped = mapRow(row)
    if (!mapped) continue
    if (mapped.kind === 'wallet') wallets.push(mapped.item)
    if (mapped.kind === 'phone') phones.push(mapped.item)
  }
  return { wallets, phones }
}

/**
 * @param {'WALLET'|'PHONE'} blacklistType
 * @param {string} value
 * @param {string} [reason]
 * @param {string} [addedBy]
 */
export async function insertAdminBlacklistEntry(blacklistType, value, reason, addedBy) {
  if (!supabaseAdmin) {
    return { error: 'Database not configured', status: 500 }
  }

  const normalized = String(value || '').trim()
  if (!normalized) {
    return { error: 'value is required', status: 400 }
  }

  const row = {
    blacklist_type: blacklistType,
    value: normalized,
    reason: String(reason || '').trim() || null,
    added_by: addedBy || null,
  }

  const { data, error } = await supabaseAdmin.from('blacklist').insert(row).select('id').single()

  if (error) {
    if (isMissingTableError(error.message)) {
      return { error: 'blacklist table not migrated', status: 503 }
    }
    if (/duplicate|unique/i.test(error.message)) {
      return { error: 'Already blacklisted', status: 409 }
    }
    return { error: error.message, status: 500 }
  }

  return { id: data?.id }
}

/**
 * @param {string} id
 */
export async function deleteAdminBlacklistEntry(id) {
  if (!supabaseAdmin) {
    return { error: 'Database not configured', status: 500 }
  }
  const entryId = String(id || '').trim()
  if (!entryId) {
    return { error: 'id is required', status: 400 }
  }

  const { error } = await supabaseAdmin.from('blacklist').delete().eq('id', entryId)

  if (error) {
    if (isMissingTableError(error.message)) {
      return { error: 'blacklist table not migrated', status: 503 }
    }
    return { error: error.message, status: 500 }
  }
  return { ok: true }
}
