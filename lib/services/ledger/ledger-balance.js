/**
 * Stage 110.3 — ledger account balances (net THB, payout debits sum).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { partnerAccountId, round2 } from '@/lib/services/ledger/ledger-shared.js'

/**
 * Sum of partner-account DEBIT lines tied to payout settlement journals (lifetime paid out, THB).
 * @param {string} partnerId
 */
export async function sumPartnerPayoutDebitsThb(partnerId) {
  const accountId = partnerAccountId(partnerId)
  if (!accountId || !supabaseAdmin) return 0
  const { data: entries, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('amount_thb, journal_id')
    .eq('account_id', accountId)
    .eq('side', 'DEBIT')
  if (error || !entries?.length) {
    if (error) console.warn('[LedgerService] sumPartnerPayoutDebitsThb entries', error.message)
    return 0
  }
  const journalIds = [...new Set(entries.map((e) => e.journal_id).filter(Boolean))]
  const { data: journals } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type')
    .in('id', journalIds)
  const payoutJournal = new Set(
    (journals || [])
      .filter((j) => j.event_type === 'PARTNER_PAYOUT_OBLIGATION_SETTLED')
      .map((j) => j.id),
  )
  let sum = 0
  for (const e of entries) {
    if (payoutJournal.has(e.journal_id)) {
      sum += round2(e.amount_thb)
    }
  }
  return round2(sum)
}

/**
 * Net THB position per account: sum(CREDIT) - sum(DEBIT).
 * @param {string[]} accountIds
 */
export async function sumNetBalancesByAccountIds(accountIds) {
  const ids = (accountIds || []).filter(Boolean)
  if (!ids.length) return {}
  if (!supabaseAdmin) throw new Error('SUPABASE_ADMIN_NOT_CONFIGURED')

  const out = {}
  for (const id of ids) out[id] = 0

  /** PostgREST `.in()` — chunk to avoid URL/size limits on large partner ledgers. */
  const CHUNK = 150
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data: rows, error } = await supabaseAdmin
      .from('ledger_entries')
      .select('account_id, side, amount_thb')
      .in('account_id', chunk)
    if (error) throw new Error(error.message)

    for (const r of rows || []) {
      const amt = round2(r.amount_thb)
      const d = out[r.account_id] ?? 0
      out[r.account_id] = r.side === 'CREDIT' ? round2(d + amt) : round2(d - amt)
    }
  }
  return out
}
