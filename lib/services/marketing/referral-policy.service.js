import { PricingService } from '@/lib/services/pricing.service'
import { readFeeSplitFromSnapshot } from '@/lib/services/booking/pricing.service'

const SAFETY_LOCK_MAX_SHARE = 0.95

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
      : round2(subtotalThb * (Number(booking?.applied_commission_rate ?? booking?.commission_rate ?? 0) / 100))
    const platformGrossRevenueThb = Math.max(0, round2(guestServiceFeeThb + hostCommissionThb))
    const insuranceReserveThb = Number.isFinite(Number(snapshot?.fee_split_v2?.insurance_reserve_thb))
      ? round2(snapshot.fee_split_v2.insurance_reserve_thb)
      : Number.isFinite(Number(snapshot?.settlement_v3?.insurance_reserve_amount?.thb))
        ? round2(snapshot.settlement_v3.insurance_reserve_amount.thb)
        : 0
    const netProfit = PricingService.calculateNetProfitOrder({
      platformGrossRevenueThb,
      insuranceReserveThb,
    })
    return {
      guestServiceFeeThb,
      hostCommissionThb,
      ...netProfit,
    }
  }

  static deriveNetProfitAfterVariableCosts(feeBase, policy) {
    const platformGrossRevenueThb = round2(feeBase?.platformGrossRevenueThb)
    const insuranceReserveThb = round2(feeBase?.insuranceReserveThb)
    const acquiringFeePercent = clamp(policy?.acquiringFeePercent, 0, 100)
    const operationalReservePercent = clamp(policy?.operationalReservePercent, 0, 100)
    const acquiringFeeThb = round2(platformGrossRevenueThb * (acquiringFeePercent / 100))
    const operationalReserveThb = round2(platformGrossRevenueThb * (operationalReservePercent / 100))
    const netProfitOrderThb = round2(
      Math.max(0, platformGrossRevenueThb - insuranceReserveThb - acquiringFeeThb - operationalReserveThb),
    )
    return {
      platformGrossRevenueThb,
      insuranceReserveThb,
      acquiringFeePercent,
      operationalReservePercent,
      acquiringFeeThb,
      operationalReserveThb,
      netProfitOrderThb,
    }
  }

  static deriveSafetyCaps(netBase, policy) {
    const referralPoolRaw = round2(
      Number(netBase?.netProfitOrderThb || 0) * (Number(policy?.referralReinvestmentPercent || 0) / 100),
    )
    const safetyCapThb = round2(Number(netBase?.platformGrossRevenueThb || 0) * SAFETY_LOCK_MAX_SHARE)
    const referralPoolThb = round2(Math.min(referralPoolRaw, safetyCapThb))
    return {
      referralPoolRaw,
      safetyCapThb,
      referralPoolThb,
    }
  }
}

export default ReferralPolicyService
