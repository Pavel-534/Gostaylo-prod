/**
 * Stage 202.24 — audit payload builders for money-adjacent admin writes.
 * SSOT shapes for admin_audit_logs.payload_json (before / after / source / adminId).
 */

function payoutAmountFields(row) {
  return {
    amount_thb: row?.amount_thb ?? null,
    amount_in_payout_currency: row?.amount_in_payout_currency ?? null,
  }
}

/**
 * @param {{ row: object, payout?: object | null, nextStatus: string, adminId?: string | null }} args
 */
export function buildPayoutStatusAuditPayload({ row, payout = null, nextStatus, adminId = null }) {
  const afterRow = payout || row
  return {
    before: {
      status: String(row?.status || '').toUpperCase(),
      ...payoutAmountFields(row),
    },
    after: {
      status: String(afterRow?.status || nextStatus).toUpperCase(),
      ...payoutAmountFields(afterRow),
    },
    source: 'admin_payouts_panel',
    adminId: adminId ? String(adminId) : null,
  }
}

/**
 * @param {{ row: object, adminId?: string | null }} args
 */
export function buildPartnerPayoutProfileVerifyAuditPayload({ row, adminId = null }) {
  return {
    before: { is_verified: row?.is_verified === true },
    after: { is_verified: true },
    source: 'admin_payout_verification',
    adminId: adminId ? String(adminId) : null,
  }
}

/**
 * @param {{ wallet: object, verifiedForPayout: boolean, adminId?: string | null }} args
 */
export function buildWalletPayoutVerificationAuditPayload({ wallet, verifiedForPayout, adminId = null }) {
  const beforeVerified = wallet?.verified_for_payout !== false
  return {
    before: { verified_for_payout: beforeVerified, user_id: wallet?.user_id ?? null },
    after: { verified_for_payout: verifiedForPayout === true, user_id: wallet?.user_id ?? null },
    source: 'admin_wallet_panel',
    adminId: adminId ? String(adminId) : null,
  }
}

/**
 * @param {{ wallet: object, adminId?: string | null }} args
 */
export function buildWalletReferralWithdrawalClearAuditPayload({ wallet, adminId = null }) {
  return {
    before: {
      referral_withdrawal_status: wallet?.referral_withdrawal_status ?? null,
      referral_withdrawal_amount_thb: wallet?.referral_withdrawal_amount_thb ?? null,
      user_id: wallet?.user_id ?? null,
    },
    after: {
      referral_withdrawal_status: null,
      referral_withdrawal_amount_thb: null,
      user_id: wallet?.user_id ?? null,
    },
    source: 'admin_wallet_panel',
    adminId: adminId ? String(adminId) : null,
  }
}
