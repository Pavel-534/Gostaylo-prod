/**
 * Stage 110.3 — partner PARTNER_EARNINGS ledger accounts.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { partnerAccountId } from '@/lib/services/ledger/ledger-shared.js'

export { partnerAccountId }

export async function ensurePartnerLedgerAccount(partnerId) {
  if (!partnerId) return null
  const id = partnerAccountId(partnerId)
  const { data: row } = await supabaseAdmin.from('ledger_accounts').select('id').eq('id', id).maybeSingle()
  if (row?.id) return id

  const { error } = await supabaseAdmin.from('ledger_accounts').insert({
    id,
    code: 'PARTNER_EARNINGS',
    partner_id: partnerId,
    display_name: 'Partner earnings (payable)',
    account_type: 'PARTNER',
  })
  if (error && !String(error.message || '').includes('duplicate')) {
    console.error('[LedgerService] ensurePartnerLedgerAccount', error.message)
    throw error
  }
  return id
}
