/**
 * Stage 124.10 — persistence для FI bank/USDT сверки (admin write, analytics read).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

function makeId() {
  return `fbr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function listBankReconciliationEntries(opts = {}) {
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 5));
  const { data, error } = await supabaseAdmin
    .from('finance_bank_reconciliation_entries')
    .select(
      'id, recorded_by, manual_balance_thb, gl_guest_clearing_thb, variance_thb, ledger_delta_thb, cash_at_risk_thb, note, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (String(error.message || '').includes('does not exist')) {
      return { success: true, rows: [], tableMissing: true };
    }
    return { success: false, error: error.message || 'BANK_RECON_LIST_FAILED' };
  }

  const rows = (data || []).map((r) => ({
    id: r.id,
    recordedBy: r.recorded_by || null,
    manualBalanceThb: round2(r.manual_balance_thb),
    glGuestClearingThb: round2(r.gl_guest_clearing_thb),
    varianceThb: round2(r.variance_thb),
    ledgerDeltaThb: r.ledger_delta_thb != null ? round2(r.ledger_delta_thb) : null,
    cashAtRiskThb: r.cash_at_risk_thb != null ? round2(r.cash_at_risk_thb) : null,
    note: r.note || null,
    createdAt: r.created_at,
  }));

  return { success: true, rows, latest: rows[0] || null };
}

/**
 * @param {{
 *   recordedBy?: string | null,
 *   manualBalanceThb: number,
 *   glGuestClearingThb: number,
 *   ledgerDeltaThb?: number | null,
 *   cashAtRiskThb?: number | null,
 *   note?: string | null,
 * }} input
 */
export async function createBankReconciliationEntry(input) {
  const manual = round2(input.manualBalanceThb);
  if (!Number.isFinite(manual) || manual <= 0) {
    return { success: false, error: 'MANUAL_BALANCE_REQUIRED' };
  }

  const gl = round2(input.glGuestClearingThb);
  const variance = round2(manual - gl);
  const id = makeId();

  const { data, error } = await supabaseAdmin
    .from('finance_bank_reconciliation_entries')
    .insert({
      id,
      recorded_by: input.recordedBy || null,
      manual_balance_thb: manual,
      gl_guest_clearing_thb: gl,
      variance_thb: variance,
      ledger_delta_thb:
        input.ledgerDeltaThb != null && Number.isFinite(Number(input.ledgerDeltaThb))
          ? round2(input.ledgerDeltaThb)
          : null,
      cash_at_risk_thb:
        input.cashAtRiskThb != null && Number.isFinite(Number(input.cashAtRiskThb))
          ? round2(input.cashAtRiskThb)
          : null,
      note: input.note ? String(input.note).slice(0, 500) : null,
    })
    .select(
      'id, manual_balance_thb, gl_guest_clearing_thb, variance_thb, ledger_delta_thb, cash_at_risk_thb, created_at',
    )
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('does not exist')) {
      return { success: false, error: 'TABLE_MISSING_APPLY_MIGRATION_124_10' };
    }
    return { success: false, error: error.message || 'BANK_RECON_INSERT_FAILED' };
  }

  return {
    success: true,
    entry: {
      id: data.id,
      manualBalanceThb: round2(data.manual_balance_thb),
      glGuestClearingThb: round2(data.gl_guest_clearing_thb),
      varianceThb: round2(data.variance_thb),
      ledgerDeltaThb: data.ledger_delta_thb != null ? round2(data.ledger_delta_thb) : null,
      cashAtRiskThb: data.cash_at_risk_thb != null ? round2(data.cash_at_risk_thb) : null,
      createdAt: data.created_at,
    },
  };
}
