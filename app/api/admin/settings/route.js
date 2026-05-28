/**
 * Admin Settings API (modular handlers)
 * GET - Fetch system settings
 * PUT - Update system settings by section
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { buildGeneralSettingsPatch } from '@/lib/admin/settings-handlers/general-settings'
import { buildFinanceSettingsPatch } from '@/lib/admin/settings-handlers/finance-settings'
import { buildMarketingSettingsPatch } from '@/lib/admin/settings-handlers/marketing-settings'
import { buildChatSafetySettingsPatch } from '@/lib/admin/settings-handlers/chat-safety-settings'
import { readSystemSettingsByKeys, upsertSystemSetting } from '@/lib/admin/system-settings-store'

export const dynamic = 'force-dynamic'

const defaultChatSafety = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
  searchRankPenaltyEnabled: true,
  searchRankPenaltyScore: 2_000_000,
}

let mockSettings = {
  defaultCommissionRate: 15,
  taxRatePercent: 0,
  guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
  hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
  insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
  referralReinvestmentPercent: 70,
  referralSplitRatio: 0.5,
  acquiringFeePercent: 0,
  operationalReservePercent: 0,
  marketingPromoPot: 0,
  promoBoostPerBooking: 0,
  promoTurboModeEnabled: false,
  organicToPromoPotPercent: 0,
  referralBoostAllocationRule: 'split_50_50',
  partnerActivationBonus: 500,
  mlmLevel1Percent: 70,
  mlmLevel2Percent: 30,
  payoutToInternalRatio: 70,
  welcomeBonusAmount: 0,
  referralMonthlyGoalThb: 10000,
  walletMaxDiscountPercent: 30,
  settlementPayoutDelayDays: 1,
  settlementPayoutHourLocal: 18,
  chatInvoiceRateMultiplier: platformDefaultChatInvoiceRateMultiplier(),
  maintenanceMode: false,
  heroTitle: 'Luxury Rentals in Phuket',
  heroSubtitle: 'Villas, Bikes, Yachts & Tours',
  sitePhone: '',
  chatSafety: { ...defaultChatSafety },
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function asNumber(value, fallback = NaN) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

async function loadTierPayoutAudit() {
  const supabase = getSupabaseClient()
  if (!supabase) return { maxTierPayoutRatio: null, tiersCount: 0, note: 'Supabase not configured' }
  const { data, error } = await supabase.from('referral_tiers').select('id,payout_ratio')
  if (error) {
    const msg = String(error?.message || '')
    if (/relation .*referral_tiers|does not exist/i.test(msg)) {
      return { maxTierPayoutRatio: null, tiersCount: 0, note: 'referral_tiers not migrated' }
    }
    return { maxTierPayoutRatio: null, tiersCount: 0, note: msg }
  }
  const rows = Array.isArray(data) ? data : []
  let maxTierPayoutRatio = 0
  for (const row of rows) {
    const ratio = asNumber(row?.payout_ratio, 0)
    if (ratio > maxTierPayoutRatio) maxTierPayoutRatio = ratio
  }
  return {
    maxTierPayoutRatio: Number.isFinite(maxTierPayoutRatio) ? maxTierPayoutRatio : 0,
    tiersCount: rows.length,
    note: 'Tier payout ratio redistributes withdrawable/internal buckets and does not increase total referral payout burn.',
  }
}

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const byKey = await readSystemSettingsByKeys(['general'])
    const data = byKey.general
    if (!data?.value) return NextResponse.json({ data: mockSettings })

    const rawComm = parseFloat(data?.value?.defaultCommissionRate)
    const rawGuestFee = parseFloat(data.value?.guestServiceFeePercent ?? data.value?.serviceFeePercent)
    const rawHostCommission = parseFloat(data.value?.hostCommissionPercent)
    const rawInsurance = parseFloat(data.value?.insuranceFundPercent)
    const rawReferralReinvestment = parseFloat(
      data.value?.referral_reinvestment_percent ?? data.value?.referralReinvestmentPercent,
    )
    const rawReferralSplit = parseFloat(data.value?.referral_split_ratio ?? data.value?.referralSplitRatio)
    const rawAcquiringFee = parseFloat(data.value?.acquiring_fee_percent ?? data.value?.acquiringFeePercent)
    const rawOperationalReserve = parseFloat(
      data.value?.operational_reserve_percent ?? data.value?.operationalReservePercent,
    )
    const rawMarketingPromoPot = parseFloat(data.value?.marketing_promo_pot ?? data.value?.marketingPromoPot)
    const rawPromoBoostPerBooking = parseFloat(data.value?.promo_boost_per_booking ?? data.value?.promoBoostPerBooking)
    const rawOrganicToPromoPotPercent = parseFloat(
      data.value?.organic_to_promo_pot_percent ?? data.value?.organicToPromoPotPercent,
    )
    const rawWelcomeBonusAmount = parseFloat(data.value?.welcome_bonus_amount ?? data.value?.welcomeBonusAmount)
    const rawReferralMonthlyGoalThb = parseFloat(
      data.value?.referral_monthly_goal_thb ?? data.value?.referralMonthlyGoalThb,
    )
    const rawWalletMaxDiscountPercent = parseFloat(
      data.value?.wallet_max_discount_percent ?? data.value?.walletMaxDiscountPercent,
    )
    const rawBoostRule = String(
      data.value?.referral_boost_allocation_rule ?? data.value?.referralBoostAllocationRule ?? 'split_50_50',
    ).toLowerCase()
    const rawPartnerActivationBonus = asNumber(data.value?.partner_activation_bonus ?? data.value?.partnerActivationBonus)
    const rawMlmLevel1Percent = asNumber(data.value?.mlm_level1_percent ?? data.value?.mlmLevel1Percent)
    const rawMlmLevel2Percent = asNumber(data.value?.mlm_level2_percent ?? data.value?.mlmLevel2Percent)
    const rawPayoutToInternalRatio = asNumber(data.value?.payout_to_internal_ratio ?? data.value?.payoutToInternalRatio)
    const rawReferralHoldDays = parseInt(
      String(data.value?.referral_hold_days ?? data.value?.referralHoldDays ?? ''),
      10,
    )
    const rawChatMult = parseFloat(data.value?.chatInvoiceRateMultiplier)
    const rawTax = parseFloat(data.value?.taxRatePercent)
    const rawCs = data.value?.chatSafety
    const chatSafety = {
      autoShadowbanEnabled: rawCs?.autoShadowbanEnabled === true,
      strikeThreshold: (() => {
        const n = parseInt(String(rawCs?.strikeThreshold ?? ''), 10)
        return Number.isFinite(n) && n >= 1 && n <= 999 ? n : defaultChatSafety.strikeThreshold
      })(),
      estimatedBookingValueThb: (() => {
        const n = parseFloat(String(rawCs?.estimatedBookingValueThb ?? ''))
        return Number.isFinite(n) && n >= 0 ? n : defaultChatSafety.estimatedBookingValueThb
      })(),
    }

    const settings = {
      defaultCommissionRate:
        Number.isFinite(rawComm) && rawComm >= 0 ? rawComm : await resolveDefaultCommissionPercent(),
      taxRatePercent: Number.isFinite(rawTax) && rawTax >= 0 && rawTax <= 100 ? rawTax : 0,
      guestServiceFeePercent: Number.isFinite(rawGuestFee) && rawGuestFee >= 0 && rawGuestFee <= 100 ? rawGuestFee : 5,
      hostCommissionPercent:
        Number.isFinite(rawHostCommission) && rawHostCommission >= 0 && rawHostCommission <= 100
          ? rawHostCommission
          : Number.isFinite(rawComm) && rawComm >= 0 && rawComm <= 100
            ? rawComm
            : await resolveDefaultCommissionPercent(),
      insuranceFundPercent: Number.isFinite(rawInsurance) && rawInsurance >= 0 && rawInsurance <= 100 ? rawInsurance : 0.5,
      referralReinvestmentPercent:
        Number.isFinite(rawReferralReinvestment) && rawReferralReinvestment >= 0 && rawReferralReinvestment <= 95
          ? rawReferralReinvestment
          : 70,
      referralSplitRatio: Number.isFinite(rawReferralSplit) && rawReferralSplit >= 0 && rawReferralSplit <= 1 ? rawReferralSplit : 0.5,
      acquiringFeePercent: Number.isFinite(rawAcquiringFee) && rawAcquiringFee >= 0 && rawAcquiringFee <= 100 ? rawAcquiringFee : 0,
      operationalReservePercent:
        Number.isFinite(rawOperationalReserve) && rawOperationalReserve >= 0 && rawOperationalReserve <= 100
          ? rawOperationalReserve
          : 0,
      marketingPromoPot: Number.isFinite(rawMarketingPromoPot) && rawMarketingPromoPot >= 0 ? rawMarketingPromoPot : 0,
      promoBoostPerBooking: Number.isFinite(rawPromoBoostPerBooking) && rawPromoBoostPerBooking >= 0 ? rawPromoBoostPerBooking : 0,
      promoTurboModeEnabled: data.value?.promo_turbo_mode_enabled === true || data.value?.promoTurboModeEnabled === true,
      organicToPromoPotPercent:
        Number.isFinite(rawOrganicToPromoPotPercent) && rawOrganicToPromoPotPercent >= 0 && rawOrganicToPromoPotPercent <= 100
          ? rawOrganicToPromoPotPercent
          : 0,
      referralBoostAllocationRule:
        rawBoostRule === '100_to_referrer' || rawBoostRule === '100_to_referee' || rawBoostRule === 'split_50_50'
          ? rawBoostRule
          : 'split_50_50',
      partnerActivationBonus:
        Number.isFinite(rawPartnerActivationBonus) && rawPartnerActivationBonus >= 0 ? rawPartnerActivationBonus : 500,
      mlmLevel1Percent: Number.isFinite(rawMlmLevel1Percent) && rawMlmLevel1Percent >= 0 && rawMlmLevel1Percent <= 100 ? rawMlmLevel1Percent : 70,
      mlmLevel2Percent: Number.isFinite(rawMlmLevel2Percent) && rawMlmLevel2Percent >= 0 && rawMlmLevel2Percent <= 100 ? rawMlmLevel2Percent : 30,
      payoutToInternalRatio:
        Number.isFinite(rawPayoutToInternalRatio) && rawPayoutToInternalRatio >= 0 && rawPayoutToInternalRatio <= 100
          ? rawPayoutToInternalRatio
          : 70,
      referralHoldDays:
        Number.isFinite(rawReferralHoldDays) && rawReferralHoldDays >= 0 && rawReferralHoldDays <= 90
          ? rawReferralHoldDays
          : 14,
      welcomeBonusAmount: Number.isFinite(rawWelcomeBonusAmount) && rawWelcomeBonusAmount >= 0 ? rawWelcomeBonusAmount : 0,
      referralMonthlyGoalThb:
        Number.isFinite(rawReferralMonthlyGoalThb) && rawReferralMonthlyGoalThb > 0
          ? Math.round(rawReferralMonthlyGoalThb * 100) / 100
          : 10000,
      walletMaxDiscountPercent:
        Number.isFinite(rawWalletMaxDiscountPercent) && rawWalletMaxDiscountPercent >= 0 && rawWalletMaxDiscountPercent <= 100
          ? rawWalletMaxDiscountPercent
          : 30,
      settlementPayoutDelayDays: (() => {
        const n = parseInt(String(data.value?.settlementPayoutDelayDays ?? ''), 10)
        return Number.isFinite(n) && n >= 0 && n <= 60 ? n : 1
      })(),
      settlementPayoutHourLocal: (() => {
        const n = parseInt(String(data.value?.settlementPayoutHourLocal ?? ''), 10)
        return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 18
      })(),
      chatInvoiceRateMultiplier:
        Number.isFinite(rawChatMult) && rawChatMult >= 1 && rawChatMult <= 1.5
          ? rawChatMult
          : platformDefaultChatInvoiceRateMultiplier(),
      maintenanceMode: data.value?.maintenanceMode || false,
      heroTitle: data.value?.heroTitle || '',
      heroSubtitle: data.value?.heroSubtitle || '',
      sitePhone: typeof data.value?.sitePhone === 'string' ? data.value.sitePhone : '',
      chatSafety,
    }

    settings.referralSafetyBudget = ReferralPnlService.computePlatformMarginBudget({
      guestServiceFeePercent: settings.guestServiceFeePercent,
      hostCommissionPercent: settings.hostCommissionPercent,
      insuranceFundPercent: settings.insuranceFundPercent,
      acquiringFeePercent: settings.acquiringFeePercent,
      operationalReservePercent: settings.operationalReservePercent,
      taxRatePercent: settings.taxRatePercent,
      referralReinvestmentPercent: settings.referralReinvestmentPercent,
      mlmLevel1Percent: settings.mlmLevel1Percent,
      mlmLevel2Percent: settings.mlmLevel2Percent,
    })
    settings.referralSafetyBudget.tierPayoutAudit = await loadTierPayoutAudit()

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const body = await request.json()
    const section = String(body?.section || body?.settingsSection || 'all').toLowerCase()
    const supabase = getSupabaseClient()

    if (!supabase) {
      const prev = { ...mockSettings }
      const applyAll = () => {
        const generalPatch = buildGeneralSettingsPatch(body, prev)
        const financePatch = buildFinanceSettingsPatch(body, prev)
        const marketingPatch = buildMarketingSettingsPatch(body, prev, {
          guestServiceFeePercent: financePatch.guestServiceFeePercent,
          hostCommissionPercent: financePatch.hostCommissionPercent,
          insuranceFundPercent: financePatch.insuranceFundPercent,
          taxRatePercent: financePatch.taxRatePercent,
        })
        if (!marketingPatch.ok) return marketingPatch
        const chatPatch = buildChatSafetySettingsPatch(body, prev)
        return { ok: true, patch: { ...generalPatch, ...financePatch, ...marketingPatch.patch, ...chatPatch } }
      }
      let result
      switch (section) {
        case 'general':
          result = { ok: true, patch: await buildGeneralSettingsPatch(body, prev) }
          break
        case 'finance':
          result = { ok: true, patch: buildFinanceSettingsPatch(body, prev) }
          break
        case 'marketing': {
          const finance = buildFinanceSettingsPatch(body, prev)
          result = buildMarketingSettingsPatch(body, prev, {
            guestServiceFeePercent: finance.guestServiceFeePercent,
            hostCommissionPercent: finance.hostCommissionPercent,
            insuranceFundPercent: finance.insuranceFundPercent,
            taxRatePercent: finance.taxRatePercent,
          })
          break
        }
        case 'chat_safety':
        case 'chat-safety':
          result = { ok: true, patch: buildChatSafetySettingsPatch(body, prev) }
          break
        case 'all':
        default:
          result = await applyAll()
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: 'SAFETY_GATE_REJECTED', details: result.details, budget: result.budget },
          { status: 400 },
        )
      }
      mockSettings = { ...mockSettings, ...result.patch }
      return NextResponse.json({ success: true, data: mockSettings })
    }

    const existingRows = await readSystemSettingsByKeys(['general'])
    const prev = existingRows.general?.value || {}

    const buildPatchBySection = async () => {
      switch (section) {
        case 'general':
          return { ok: true, patch: await buildGeneralSettingsPatch(body, prev) }
        case 'finance':
          return { ok: true, patch: buildFinanceSettingsPatch(body, prev) }
        case 'marketing': {
          const finance = buildFinanceSettingsPatch(body, prev)
          return buildMarketingSettingsPatch(body, prev, {
            guestServiceFeePercent: finance.guestServiceFeePercent,
            hostCommissionPercent: finance.hostCommissionPercent,
            insuranceFundPercent: finance.insuranceFundPercent,
            taxRatePercent: finance.taxRatePercent,
          })
        }
        case 'chat_safety':
        case 'chat-safety':
          return { ok: true, patch: buildChatSafetySettingsPatch(body, prev) }
        case 'all':
        default: {
          const generalPatch = await buildGeneralSettingsPatch(body, prev)
          const financePatch = buildFinanceSettingsPatch(body, prev)
          const marketingPatch = buildMarketingSettingsPatch(body, prev, {
            guestServiceFeePercent: financePatch.guestServiceFeePercent,
            hostCommissionPercent: financePatch.hostCommissionPercent,
            insuranceFundPercent: financePatch.insuranceFundPercent,
            taxRatePercent: financePatch.taxRatePercent,
          })
          if (!marketingPatch.ok) return marketingPatch
          const chatPatch = buildChatSafetySettingsPatch(body, prev)
          return { ok: true, patch: { ...generalPatch, ...financePatch, ...marketingPatch.patch, ...chatPatch } }
        }
      }
    }

    const result = await buildPatchBySection()
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: 'SAFETY_GATE_REJECTED', details: result.details, budget: result.budget },
        { status: 400 },
      )
    }

    const newValue = { ...prev, ...result.patch }
    try {
      await upsertSystemSetting('general', newValue)
    } catch (dbErr) {
      console.error('Failed to save settings:', dbErr)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }
    const guestFee = parseFloat(newValue?.guestServiceFeePercent ?? newValue?.guest_service_fee_percent)
    const hostComm = parseFloat(newValue?.hostCommissionPercent ?? newValue?.host_commission_percent)
    const insurance = parseFloat(newValue?.insuranceFundPercent ?? newValue?.insurance_fund_percent)
    const tax = parseFloat(newValue?.taxRatePercent)
    const budget = ReferralPnlService.computePlatformMarginBudget({
      guestServiceFeePercent: Number.isFinite(guestFee) ? guestFee : PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: Number.isFinite(hostComm) ? hostComm : PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      insuranceFundPercent: Number.isFinite(insurance) ? insurance : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
      acquiringFeePercent: parseFloat(newValue?.acquiring_fee_percent ?? newValue?.acquiringFeePercent) || 0,
      operationalReservePercent:
        parseFloat(newValue?.operational_reserve_percent ?? newValue?.operationalReservePercent) || 0,
      taxRatePercent: Number.isFinite(tax) && tax >= 0 ? tax : 0,
      referralReinvestmentPercent:
        parseFloat(newValue?.referral_reinvestment_percent ?? newValue?.referralReinvestmentPercent) || 70,
      mlmLevel1Percent: parseFloat(newValue?.mlm_level1_percent ?? newValue?.mlmLevel1Percent) || 70,
      mlmLevel2Percent: parseFloat(newValue?.mlm_level2_percent ?? newValue?.mlmLevel2Percent) || 30,
    })
    return NextResponse.json({ success: true, data: newValue, budget })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
