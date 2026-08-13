/**
 * Stage 201.09 — call SECURITY DEFINER RPC to purge TEST ledger rows.
 * Live money stays append-only; cron uses scope=markers only.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ scope?: 'markers' | 'all' }} [opts]
 */
export async function purgeTestLedgerRows(sb, opts = {}) {
  const scope = opts.scope === 'all' ? 'all' : 'markers'
  const { data, error } = await sb.rpc('purge_test_ledger_rows', { p_scope: scope })
  if (error) {
    console.warn('[purge-test-ledger]', error.message)
    return { success: false, error: error.message, scope }
  }
  const payload = data && typeof data === 'object' ? data : {}
  return {
    success: true,
    scope,
    entries: Number(payload.entries || 0),
    journals: Number(payload.journals || 0),
    partnerAccounts: Number(payload.partner_accounts || 0),
  }
}
