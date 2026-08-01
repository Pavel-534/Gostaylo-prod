/**
 * AUDIT_LEDGER_01 C-L4 — journals/entries are append-only (DB trigger).
 * Compensating DELETE is forbidden; leave orphan journal and return error.
 * Callers that re-enter with the same idempotency key should heal empty journals
 * via {@link journalNeedsEntryHeal}.
 */

export function isLedgerAppendOnlyError(err) {
  const msg = String(err?.message || err || '')
  return msg.includes('append-only') || msg.includes('AUDIT_LEDGER_01 C-L4')
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} journalId
 * @returns {Promise<boolean>} true if journal has zero entries (safe to INSERT lines)
 */
export async function journalNeedsEntryHeal(sb, journalId) {
  if (!sb || !journalId) return false
  const { count, error } = await sb
    .from('ledger_entries')
    .select('id', { count: 'exact', head: true })
    .eq('journal_id', journalId)
  if (error) {
    console.warn('[ledger-append-only] entry count', error.message)
    return false
  }
  return (count ?? 0) === 0
}

/**
 * Former compensating delete — now no-op under append-only (logs + optional critical signal).
 * @param {string} journalId
 * @param {string} reason
 */
export async function skipCompensatingJournalDelete(journalId, reason) {
  console.error(
    '[ledger-append-only] orphan journal left (DELETE forbidden):',
    journalId,
    reason || '',
  )
}
