/**
 * Flatten compliance JSON for accountant CSV export (Stage 98).
 */

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * @param {object} data — compliance API payload
 * @returns {string}
 */
export function complianceToCsv(data) {
  const fb = data?.final_breakdown || {}
  const split = data?.fee_split_v2 || fb?.fee_split || {}
  const fiscal = data?.fiscal || {}
  const meta = data?.fiscal_metadata || {}
  const rows = [
    ['field', 'value'],
    ['booking_id', data?.booking_id],
    ['status', data?.status],
    ['pricing_snapshot_v', data?.pricing_snapshot_v],
    ['guest_total_thb', fb?.guest_total_thb ?? fb?.guest_total],
    ['subtotal_thb', fb?.subtotal_thb ?? fb?.subtotal],
    ['rounding_pot_thb', data?.rounding_pot_thb],
    ['ru_agent_thb', split?.ru_agent_thb ?? split?.ru_agent],
    ['kg_service_thb', split?.kg_service_thb ?? split?.kg_service],
    ['fx_markup_thb', split?.fx_markup_thb ?? split?.fx_markup],
    ['partner_net_thb', fb?.partner_net_thb ?? fb?.partner_net],
    ['fiscal_status', meta?.status ?? fiscal?.status],
    ['fiscal_receipt_id', meta?.receipt_id ?? meta?.receiptId],
    ['fiscal_payment_method', fiscal?.payment_method],
    ['fiscal_agent_sign', fiscal?.agent_sign],
    ['ledger_legs_count', Array.isArray(data?.ledger_legs) ? data.ledger_legs.length : 0],
  ]
  if (Array.isArray(data?.ledger_legs)) {
    rows.push([])
    rows.push(['ledger_account', 'side', 'amount_thb', 'amount_rub', 'description'])
    for (const leg of data.ledger_legs) {
      rows.push([
        leg.account || leg.account_id,
        leg.side,
        leg.amount_thb ?? leg.amountThb,
        leg.amount_rub ?? leg.amountRub,
        leg.description,
      ])
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}
