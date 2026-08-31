import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { getFintechSettingsForAdmin } from '@/lib/services/finance/fintech-settings.service.js'
import {
  computeLaunchPromoPlan,
  fintechSettingsToPolicy,
  normalizePlannerInputs,
} from '@/lib/admin/launch-promo-planner.js'

export const dynamic = 'force-dynamic'

/** POST — what-if launch promo plan (SSOT waterfall; server-only). */
export async function POST(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const body = await request.json().catch(() => ({}))
    const { api } = await getFintechSettingsForAdmin()
    const basePolicy = fintechSettingsToPolicy(api, {
      referralReinvestmentPercent: body?.referralReinvestmentPercent ?? body?.referral_reinvestment_percent,
    })

    const totalBookings = Number(body?.totalBookingsPerMonth ?? body?.total_bookings_per_month ?? 0)
    const referralShare = Number(body?.referralSharePercent ?? body?.referral_share_percent ?? 100)
    const referralBookingsPerMonth =
      body?.referralBookingsPerMonth ?? body?.referral_bookings_per_month ??
      Math.round((totalBookings * referralShare) / 100)

    const inputs = normalizePlannerInputs({
      subtotalThb: body?.subtotalThb ?? body?.subtotal_thb,
      guestServiceFeePercent: body?.guestServiceFeePercent ?? body?.guest_service_fee_percent,
      referralReinvestmentPercent: body?.referralReinvestmentPercent ?? body?.referral_reinvestment_percent,
      totalBookingsPerMonth: totalBookings,
      referralBookingsPerMonth,
      turboBoostThbPerBooking: body?.turboBoostThbPerBooking ?? body?.turbo_boost_thb_per_booking,
      promoTankThb: body?.promoTankThb ?? body?.promo_tank_thb,
      hostActivationsPerMonth: body?.hostActivationsPerMonth ?? body?.host_activations_per_month,
    })

    const plan = computeLaunchPromoPlan(basePolicy, inputs)
    return NextResponse.json({ success: true, data: plan })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'LAUNCH_PLANNER_FAILED', message: e?.message || 'plan failed' },
      { status: 500 },
    )
  }
}
