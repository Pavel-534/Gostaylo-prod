/**
 * Stage 114.4 — CSV export referral_ledger для FinTech.
 */

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function referralLedgerToCsv(rows) {
  const header = [
    'id',
    'amount_thb',
    'type',
    'status',
    'referral_type',
    'ledger_depth',
    'referrer_id',
    'referrer_email',
    'referee_id',
    'booking_id',
    'earned_at',
    'created_at',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.amount_thb,
        row.type,
        row.status,
        row.referral_type,
        row.ledger_depth,
        row.referrer_id,
        row.referrer_email,
        row.referee_id,
        row.booking_id,
        row.earned_at,
        row.created_at,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}
