import { PricingService } from '@/lib/services/pricing.service'
import { readFeeSplitFromSnapshot } from '@/lib/services/booking/pricing.service'
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function readGuestPaymentThbFromSnapshot(snapshot, subtotalThb, guestServiceFeeThb) {
  const fb = snapshot?.final_breakdown
  const fs = snapshot?.fee_split_v2
  const fromFb = Number(fb?.total_guest_payable_rounded_thb ?? fb?.total_guest_payable_thb)
  if (Number.isFinite(fromFb) && fromFb > 0) return round2(fromFb)
  const fromFs = Number(fs?.guest_payable_rounded_thb ?? fs?.guest_payable_thb)
  if (Number.isFinite(fromFs) && fromFs > 0) return round2(fromFs)
  return round2(Math.max(0, subtotalThb + guestServiceFeeThb))
}

function readFxMarkupThbFromSnapshot(snapshot) {
  const raw = Number(
    snapshot?.final_breakdown?.fx_markup_thb ??
      snapshot?.fee_split_v2?.fx_markup_thb ??
      snapshot?.fx_markup_thb,
  )
  return Number.isFinite(raw) && raw > 0 ? round2(raw) : 0
}

export class ReferralPolicyService {
  static deriveFeeBaseFromBooking(booking) {
    const snapshot =
      booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
        ? booking.pricing_snapshot
        : {}
    const fs = readFeeSplitFromSnapshot(snapshot)
    const subtotalThb = round2(booking?.price_thb)
    const guestServiceFeeThb = Number.isFinite(fs?.guestServiceFeeThb)
      ? round2(fs.guestServiceFeeThb)
      : round2(booking?.commission_thb)
    const hostCommissionThb = Number.isFinite(fs?.hostCommissionThb)
      ? round2(fs.hostCommissionThb)
      : round2(
          subtotalThb *
            (Number(booking?.applied_commission_rate ?? booking?.commission_rate ?? 0) / 100),
        )
    const platformGrossRevenueThb = Math.max(0, round2(guestServiceFeeThb + hostCommissionThb))
    const insuranceReserveThb = Number.isFinite(Number(snapshot?.fee_split_v2?.insurance_reserve_thb))
      ? round2(snapshot.fee_split_v2.insurance_reserve_thb)
      : Number.isFinite(Number(snapshot?.settlement_v3?.insurance_reserve_amount?.thb))
        ? round2(snapshot.settlement_v3.insurance_reserve_amount.thb)
        : 0
    const guestPaymentThb = readGuestPaymentThbFromSnapshot(
      snapshot,
      subtotalThb,
      guestServiceFeeThb,
    )
    const fxMarkupThb = readFxMarkupThbFromSnapshot(snapshot)
    const ownerRevenueThb = round2(platformGrossRevenueThb + fxMarkupThb)
    const netProfit = PricingService.calculateNetProfitOrder({
      platformGrossRevenueThb,
      insuranceReserveThb,
    })
    return {
      guestServiceFeeThb,
      hostCommissionThb,
      guestPaymentThb,
      fxMarkupThb,
      ownerRevenueThb,
      ...netProfit,
    }
  }

  /**
   * Legacy path (pre–Ambassador 3.0 waterfall) — acquiring from commission gross.
   */
  static deriveNetProfitAfterVariableCostsLegacy(feeBase, policy) {
    const platformGrossRevenueThb = round2(feeBase?.platformGrossRevenueThb)
    const insuranceReserveThb = round2(feeBase?.insuranceReserveThb)
    const acquiringFeePercent = clamp(policy?.acquiringFeePercent, 0, 100)
    const operationalReservePercent = clamp(policy?.operationalReservePercent, 0, 100)
    const acquiringFeeThb = round2(platformGrossRevenueThb * (acquiringFeePercent / 100))
    const operationalReserveThb = round2(platformGrossRevenueThb * (operationalReservePercent / 100))
    const netProfitOrderThb = round2(
      Math.max(
        0,
        platformGrossRevenueThb - insuranceReserveThb - acquiringFeeThb - operationalReserveThb,
      ),
    )
    return {
      platformGrossRevenueThb,
      insuranceReserveThb,
      acquiringFeePercent,
      operationalReservePercent,
      acquiringFeeThb,
      operationalReserveThb,
      usnProvisionThb: 0,
      vatProvisionThb: 0,
      reserveBankThb: 0,
      guestPaymentThb: round2(feeBase?.guestPaymentThb),
      fxMarkupThb: round2(feeBase?.fxMarkupThb),
      ownerRevenueThb: round2(feeBase?.ownerRevenueThb ?? platformGrossRevenueThb),
      adjustedNetThb: netProfitOrderThb,
      netProfitOrderThb,
      waterfallMode: 'legacy',
    }
  }

  /**
   * Ambassador 3.0 owner waterfall — acquiring from guest_payment_thb; tax on owner_revenue.
   */
  static deriveOwnerWaterfall(feeBase, config) {
    const platformGrossRevenueThb = round2(feeBase?.platformGrossRevenueThb)
    const insuranceReserveThb = round2(feeBase?.insuranceReserveThb)
    const guestPaymentThb = round2(feeBase?.guestPaymentThb)
    const fxMarkupThb = round2(feeBase?.fxMarkupThb)
    const ownerRevenueThb = round2(feeBase?.ownerRevenueThb ?? platformGrossRevenueThb)

    const acquiringFeePercent = clamp(config?.acquiringFeePercent, 0, 100)
    const usnProvisionPercent = clamp(config?.usnProvisionPercent, 0, 100)
    const vatProvisionPercent = clamp(config?.vatProvisionPercent, 0, 100)
    const reserveBankPercent = clamp(config?.reserveBankPercent, 0, 100)
    const operationalReservePercent = clamp(config?.operationalReservePercent, 0, 100)

    const acquiringFeeThb = round2(guestPaymentThb * (acquiringFeePercent / 100))
    const usnProvisionThb = round2(ownerRevenueThb * (usnProvisionPercent / 100))
    const vatProvisionThb = round2(ownerRevenueThb * (vatProvisionPercent / 100))
    const reserveBankThb = round2(platformGrossRevenueThb * (reserveBankPercent / 100))
    const operationalReserveThb = round2(platformGrossRevenueThb * (operationalReservePercent / 100))

    const adjustedNetThb = round2(
      Math.max(
        0,
        ownerRevenueThb -
          insuranceReserveThb -
          acquiringFeeThb -
          usnProvisionThb -
          vatProvisionThb -
          reserveBankThb -
          operationalReserveThb,
      ),
    )

    return {
      platformGrossRevenueThb,
      insuranceReserveThb,
      acquiringFeePercent,
      operationalReservePercent,
      acquiringFeeThb,
      operationalReserveThb,
      usnProvisionPercent,
      vatProvisionPercent,
      reserveBankPercent,
      usnProvisionThb,
      vatProvisionThb,
      reserveBankThb,
      guestPaymentThb,
      fxMarkupThb,
      ownerRevenueThb,
      adjustedNetThb,
      netProfitOrderThb: adjustedNetThb,
      waterfallMode: 'ambassador_3',
    }
  }

  static deriveNetProfitAfterVariableCosts(feeBase, policy) {
    if (policy?.ambassador3WaterfallEnabled === true) {
      return ReferralPolicyService.deriveOwnerWaterfall(feeBase, policy)
    }
    return ReferralPolicyService.deriveNetProfitAfterVariableCostsLegacy(feeBase, policy)
  }

  static deriveSafetyCaps(netBase, policy) {
    const safetyMaxShare = clamp(policy?.safetyLockMaxShare ?? 0.95, 0.01, 1)
    const basisThb = round2(netBase?.adjustedNetThb ?? netBase?.netProfitOrderThb ?? 0)
    const referralPoolRaw = round2(
      basisThb * (Number(policy?.referralReinvestmentPercent || 0) / 100),
    )
    const safetyCapThb = round2(
      Number(netBase?.platformGrossRevenueThb || 0) * safetyMaxShare,
    )
    const referralPoolThb = round2(Math.min(referralPoolRaw, safetyCapThb))
    const ownerRetainedThb = round2(Math.max(0, basisThb - referralPoolThb))
    return {
      referralPoolRaw,
      safetyCapThb,
      referralPoolThb,
      ownerRetainedThb,
      safetyLockMaxShare: safetyMaxShare,
    }
  }

  /**
   * P1-ready: split guest pool across L1 / L2 / referee (no ledger writes).
   */
  static deriveGuestPoolSplit(referralPoolThb, config) {
    const pool = round2(Math.max(0, referralPoolThb))
    const split = SystemConfigService.resolveGuestPoolSplitPercents(config)
    const l1AmountThb = round2((pool * split.l1Percent) / 100)
    const l2AmountThb = round2((pool * split.l2Percent) / 100)
    const refereeAmountThb = round2((pool * split.refereePercent) / 100)
    const drift = round2(pool - l1AmountThb - l2AmountThb - refereeAmountThb)
    return {
      poolThb: pool,
      splitMode: split.mode,
      l1AmountThb: round2(l1AmountThb + (split.l2Percent === 0 ? drift : 0)),
      l2AmountThb,
      refereeAmountThb: round2(refereeAmountThb + (split.l2Percent > 0 ? drift : 0)),
      l1Percent: split.l1Percent,
      l2Percent: split.l2Percent,
      refereePercent: split.refereePercent,
    }
  }

  /**
   * Live ledger split for guest_booking distribute.
   * When L2 flag is off: pay L1 + guest (45/43), withhold L2 share (12%) → owner retained.
   */
  static resolveLiveGuestPoolPayout(referralPoolThb, policy) {
    const grossPoolThb = round2(Math.max(0, referralPoolThb))

    if (policy?.ambassadorGuestL2Enabled === true) {
      const split = ReferralPolicyService.deriveGuestPoolSplit(grossPoolThb, policy)
      return {
        splitMode: 'live_l2_enabled',
        grossPoolThb,
        payablePoolThb: grossPoolThb,
        referrerAmountThb: split.l1AmountThb,
        refereeAmountThb: split.refereeAmountThb,
        l2AmountThb: split.l2AmountThb,
        l2WithheldThb: 0,
        l1Percent: split.l1Percent,
        l2Percent: split.l2Percent,
        refereePercent: split.refereePercent,
      }
    }

    const l1Pct = Number(policy?.ambassadorGuestPoolL1Percent ?? 45)
    const l2Pct = Number(policy?.ambassadorGuestPoolL2Percent ?? 12)
    const guestPct = Number(policy?.ambassadorGuestPoolRefereePercent ?? 43)
    const referrerAmountThb = round2((grossPoolThb * l1Pct) / 100)
    const l2WithheldThb = round2((grossPoolThb * l2Pct) / 100)
    const refereeAmountThb = round2(grossPoolThb - referrerAmountThb - l2WithheldThb)

    return {
      splitMode: 'shadow_l2_withheld',
      grossPoolThb,
      payablePoolThb: round2(referrerAmountThb + refereeAmountThb),
      referrerAmountThb,
      refereeAmountThb,
      l2AmountThb: 0,
      l2WithheldThb,
      l1Percent: l1Pct,
      l2Percent: l2Pct,
      refereePercent: guestPct,
    }
  }
}

export default ReferralPolicyService
