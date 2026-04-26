/**
 * Partner finances dashboard aggregates (Stage 45.3).
 * Escrow / available buckets align with EscrowService.getPartnerBalance (booking-state SSOT).
 * totalPaidThb aligns with ledger PARTNER_PAYOUT_OBLIGATION_SETTLED debits on partner account.
 */

import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'
import { LedgerService } from '@/lib/services/ledger.service'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service.js'

const TOLERANCE_THB = 0.05

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

const PENDING_PAYMENT_STATUSES = new Set([BookingStatus.PENDING, BookingStatus.CONFIRMED])

const EXCLUDED_FROM_PORTFOLIO = new Set([BookingStatus.CANCELLED, BookingStatus.REFUNDED])

/**
 * @param {string} partnerId
 */
export async function computePartnerFinancesSummary(partnerId) {
  if (!partnerId) {
    return { success: false, error: 'PARTNER_ID_REQUIRED' }
  }
  if (!supabaseAdmin) {
    return {
      success: true,
      data: {
        pendingThb: 0,
        escrowThb: 0,
        availableThb: 0,
        totalPaidThb: 0,
        ledgerPartnerNetThb: 0,
        reconciliation: {
          escrowPlusAvailableThb: 0,
          ledgerPartnerNetThb: 0,
          differenceThb: 0,
          withinTolerance: true,
          note: 'supabase_admin_unconfigured',
        },
        portfolio: { grossThb: 0, feeThb: 0, netThb: 0, bookingCount: 0 },
      },
    }
  }

  const [bal, ledgerNetByAcc, totalPaidThb] = await Promise.all([
    EscrowService.getPartnerBalance(partnerId),
    LedgerService.sumNetBalancesByAccountIds([LedgerService.partnerAccountId(partnerId)]),
    LedgerService.sumPartnerPayoutDebitsThb(partnerId),
  ])

  const partnerAcc = LedgerService.partnerAccountId(partnerId)
  const ledgerPartnerNetThb = round2(ledgerNetByAcc[partnerAcc] ?? 0)
  const escrowThb = round2(
    bal?.success === false ? 0 : bal.balance?.frozenBalanceThb ?? bal.balance?.escrowBalance ?? 0,
  )
  const availableThb = round2(
    bal?.success === false ? 0 : bal.balance?.availableBalanceThb ?? bal.balance?.availableBalance ?? 0,
  )
  const escrowPlusAvailableThb = round2(escrowThb + availableThb)
  const differenceThb = round2(escrowPlusAvailableThb - ledgerPartnerNetThb)

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,status,currency,listing_currency,price_thb,price_paid,exchange_rate,commission_thb,commission_rate,applied_commission_rate,partner_earnings_thb,taxable_margin_amount,rounding_diff_pot,pricing_snapshot,metadata,
      listing:listings(category_id,categories(slug))
    `,
    )
    .eq('partner_id', partnerId)

  if (error) {
    return { success: false, error: error.message || 'BOOKINGS_READ_FAILED' }
  }

  let pendingThb = 0
  let portfolioGross = 0
  let portfolioFee = 0
  let portfolioNet = 0
  let portfolioCount = 0

  for (const row of rows || []) {
    const snap = buildBookingFinancialSnapshotFromRow(row)
    if (!snap) continue
    const st = String(row.status || '')
    if (PENDING_PAYMENT_STATUSES.has(st)) {
      pendingThb += snap.net
    }
    if (!EXCLUDED_FROM_PORTFOLIO.has(st)) {
      portfolioGross += snap.gross
      portfolioFee += snap.fee
      portfolioNet += snap.net
      portfolioCount += 1
    }
  }

  return {
    success: true,
    data: {
      pendingThb: round2(pendingThb),
      escrowThb,
      availableThb,
      totalPaidThb: round2(totalPaidThb),
      ledgerPartnerNetThb,
      reconciliation: {
        escrowPlusAvailableThb,
        ledgerPartnerNetThb,
        differenceThb,
        withinTolerance: Math.abs(differenceThb) <= TOLERANCE_THB,
      },
      portfolio: {
        grossThb: round2(portfolioGross),
        feeThb: round2(portfolioFee),
        netThb: round2(portfolioNet),
        bookingCount: portfolioCount,
      },
    },
  }
}
