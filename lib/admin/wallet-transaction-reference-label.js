/**
 * Human-readable labels for wallet_transactions.reference_id (admin audit SSOT).
 * Stage 91.2 — replaces raw `referral_ledger:<id>` in UI.
 */

const REFERRAL_LEDGER_PREFIX = 'referral_ledger:'

function profileDisplay(p) {
  if (!p) return null
  const fn = String(p.first_name || '').trim()
  const ln = String(p.last_name || '').trim()
  const name = [fn, ln].filter(Boolean).join(' ')
  if (name) return name
  const em = String(p.email || '').trim()
  return em || null
}

function shortId(id) {
  const s = String(id || '').trim()
  if (!s) return '—'
  return s.length > 14 ? `${s.slice(0, 12)}…` : s
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {Array<{ reference_id?: string | null; tx_type?: string | null; user_id?: string | null }>} txs
 * @returns {Promise<Record<string, string>>} map reference_id raw -> human label (RU)
 */
export async function buildWalletReferenceLabels(supabaseAdmin, txs) {
  /** @type {Map<string, string>} */
  const ledgerIdByRef = new Map()
  for (const t of txs || []) {
    const ref = String(t?.reference_id || '').trim()
    if (!ref.startsWith(REFERRAL_LEDGER_PREFIX)) continue
    const lid = ref.slice(REFERRAL_LEDGER_PREFIX.length)
    if (lid) ledgerIdByRef.set(ref, lid)
  }
  const ledgerIds = [...new Set([...ledgerIdByRef.values()])]
  if (!ledgerIds.length || !supabaseAdmin) {
    return {}
  }
  const { data: ledgers, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('id, referee_id, referrer_id, type, booking_id')
    .in('id', ledgerIds)
  if (error || !ledgers?.length) {
    return {}
  }

  const personIds = [...new Set(ledgers.flatMap((row) => [row.referee_id, row.referrer_id].filter(Boolean)))].map(
    String,
  )
  let profMap = {}
  if (personIds.length) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name')
      .in('id', personIds)
    profMap = Object.fromEntries((profs || []).map((p) => [String(p.id), p]))
  }

  /** @type {Record<string, string>} */
  const refereeLabelByLedgerId = {}
  for (const row of ledgers) {
    const rid = String(row.id)
    const refereeP = profMap[String(row.referee_id)]
    refereeLabelByLedgerId[rid] = profileDisplay(refereeP) || shortId(row.referee_id)
  }

  /** @type {Record<string, string>} */
  const out = {}
  for (const [ref, lid] of ledgerIdByRef) {
    const row = ledgers.find((r) => String(r.id) === lid)
    const friendLabel = refereeLabelByLedgerId[lid] || shortId(lid)
    const txType = String(
      txs.find((x) => String(x?.reference_id || '').trim() === ref)?.tx_type || '',
    ).toLowerCase()
    if (!row) {
      out[ref] = `Реферальное начисление (ledger ${shortId(lid)})`
      continue
    }
    if (txType === 'referral_bonus') {
      out[ref] = `Бонус за друга: ${friendLabel}`
      continue
    }
    if (txType === 'referral_cashback') {
      const bidShort = row.booking_id ? shortId(row.booking_id) : ''
      out[ref] = bidShort
        ? `Кешбэк за поездку по приглашению (бронь ${bidShort})`
        : 'Кешбэк за поездку по приглашению'
      continue
    }
    out[ref] = `Реферальная операция — друг/гость: ${friendLabel}`
  }
  return out
}
