/**
 * Admin Settings API
 * GET - Fetch system settings
 * PUT - Update system settings
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

// Mock settings for when Supabase is not configured
const defaultChatSafety = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
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
  /** Stage 73.3 — дефолтная цель дохода реферала за месяц (THB), если не задана в профиле */
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

// Helper to get supabase client (returns null if not configured)
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

function buildReferralSafetyGuard(values) {
  const budget = ReferralPnlService.computePlatformMarginBudget(values)
  const errors = []
  if (budget.mlmLevelsTotalPercent > 100) {
    errors.push('MLM split invalid: level1 + level2 must be <= 100%.')
  }
  if (!budget.isWithinMargin) {
    errors.push(
      `Safety gate: payouts+costs (${budget.projectedTotalBurnPercent.toFixed(2)}%) exceed platform margin (${budget.platformMarginPercent.toFixed(2)}%).`,
    )
  }
  if (budget.platformMarginPercent <= 0) {
    errors.push('Platform margin must be > 0 (guestServiceFeePercent + hostCommissionPercent).')
  }
  return {
    ok: errors.length === 0,
    errors,
    budget,
  }
}

async function loadTierPayoutAudit() {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { maxTierPayoutRatio: null, tiersCount: 0, note: 'Supabase not configured' }
  }
  const { data, error } = await supabase
    .from('referral_tiers')
    .select('id,payout_ratio')
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
    note:
      'Tier payout ratio redistributes withdrawable/internal buckets and does not increase total referral payout burn.',
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // If Supabase is not configured, return mock settings
    if (!supabaseUrl || !serviceKey) {
      console.log('[SETTINGS] Supabase not configured, using mock settings')
      return NextResponse.json({ data: mockSettings })
    }
    
    // Use direct REST API to bypass SDK caching
    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=eq.general&select=*`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      }
    )
    
    const settingsData = await res.json()
    
    if (!settingsData || settingsData.length === 0) {
      console.error('No settings found in database')
      return NextResponse.json({ data: mockSettings })
    }

    const data = settingsData[0]
    
    // Map from DB format to frontend format
    const rawComm = parseFloat(data.value?.defaultCommissionRate)
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
    const rawPromoBoostPerBooking = parseFloat(
      data.value?.promo_boost_per_booking ?? data.value?.promoBoostPerBooking,
    )
    const rawOrganicToPromoPotPercent = parseFloat(
      data.value?.organic_to_promo_pot_percent ?? data.value?.organicToPromoPotPercent,
    )
    const rawWelcomeBonusAmount = parseFloat(
      data.value?.welcome_bonus_amount ?? data.value?.welcomeBonusAmount,
    )
    const rawReferralMonthlyGoalThb = parseFloat(
      data.value?.referral_monthly_goal_thb ?? data.value?.referralMonthlyGoalThb,
    )
    const rawWalletMaxDiscountPercent = parseFloat(
      data.value?.wallet_max_discount_percent ?? data.value?.walletMaxDiscountPercent,
    )
    const rawBoostRule = String(
      data.value?.referral_boost_allocation_rule ?? data.value?.referralBoostAllocationRule ?? 'split_50_50',
    ).toLowerCase()
    const rawPartnerActivationBonus = asNumber(
      data.value?.partner_activation_bonus ?? data.value?.partnerActivationBonus,
    )
    const rawMlmLevel1Percent = asNumber(
      data.value?.mlm_level1_percent ?? data.value?.mlmLevel1Percent,
    )
    const rawMlmLevel2Percent = asNumber(
      data.value?.mlm_level2_percent ?? data.value?.mlmLevel2Percent,
    )
    const rawPayoutToInternalRatio = asNumber(
      data.value?.payout_to_internal_ratio ?? data.value?.payoutToInternalRatio,
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
      defaultCommissionRate: Number.isFinite(rawComm) && rawComm >= 0
        ? rawComm
        : await resolveDefaultCommissionPercent(),
      taxRatePercent: Number.isFinite(rawTax) && rawTax >= 0 && rawTax <= 100 ? rawTax : 0,
      guestServiceFeePercent:
        Number.isFinite(rawGuestFee) && rawGuestFee >= 0 && rawGuestFee <= 100 ? rawGuestFee : 5,
      hostCommissionPercent:
        Number.isFinite(rawHostCommission) && rawHostCommission >= 0 && rawHostCommission <= 100
          ? rawHostCommission
          : Number.isFinite(rawComm) && rawComm >= 0 && rawComm <= 100
            ? rawComm
            : await resolveDefaultCommissionPercent(),
      insuranceFundPercent:
        Number.isFinite(rawInsurance) && rawInsurance >= 0 && rawInsurance <= 100 ? rawInsurance : 0.5,
      referralReinvestmentPercent:
        Number.isFinite(rawReferralReinvestment) &&
        rawReferralReinvestment >= 0 &&
        rawReferralReinvestment <= 95
          ? rawReferralReinvestment
          : 70,
      referralSplitRatio:
        Number.isFinite(rawReferralSplit) && rawReferralSplit >= 0 && rawReferralSplit <= 1
          ? rawReferralSplit
          : 0.5,
      acquiringFeePercent:
        Number.isFinite(rawAcquiringFee) && rawAcquiringFee >= 0 && rawAcquiringFee <= 100
          ? rawAcquiringFee
          : 0,
      operationalReservePercent:
        Number.isFinite(rawOperationalReserve) && rawOperationalReserve >= 0 && rawOperationalReserve <= 100
          ? rawOperationalReserve
          : 0,
      marketingPromoPot:
        Number.isFinite(rawMarketingPromoPot) && rawMarketingPromoPot >= 0 ? rawMarketingPromoPot : 0,
      promoBoostPerBooking:
        Number.isFinite(rawPromoBoostPerBooking) && rawPromoBoostPerBooking >= 0
          ? rawPromoBoostPerBooking
          : 0,
      promoTurboModeEnabled:
        data.value?.promo_turbo_mode_enabled === true || data.value?.promoTurboModeEnabled === true,
      organicToPromoPotPercent:
        Number.isFinite(rawOrganicToPromoPotPercent) &&
        rawOrganicToPromoPotPercent >= 0 &&
        rawOrganicToPromoPotPercent <= 100
          ? rawOrganicToPromoPotPercent
          : 0,
      referralBoostAllocationRule:
        rawBoostRule === '100_to_referrer' || rawBoostRule === '100_to_referee' || rawBoostRule === 'split_50_50'
          ? rawBoostRule
          : 'split_50_50',
      partnerActivationBonus:
        Number.isFinite(rawPartnerActivationBonus) && rawPartnerActivationBonus >= 0
          ? rawPartnerActivationBonus
          : 500,
      mlmLevel1Percent:
        Number.isFinite(rawMlmLevel1Percent) && rawMlmLevel1Percent >= 0 && rawMlmLevel1Percent <= 100
          ? rawMlmLevel1Percent
          : 70,
      mlmLevel2Percent:
        Number.isFinite(rawMlmLevel2Percent) && rawMlmLevel2Percent >= 0 && rawMlmLevel2Percent <= 100
          ? rawMlmLevel2Percent
          : 30,
      payoutToInternalRatio:
        Number.isFinite(rawPayoutToInternalRatio) &&
        rawPayoutToInternalRatio >= 0 &&
        rawPayoutToInternalRatio <= 100
          ? rawPayoutToInternalRatio
          : 70,
      welcomeBonusAmount:
        Number.isFinite(rawWelcomeBonusAmount) && rawWelcomeBonusAmount >= 0 ? rawWelcomeBonusAmount : 0,
      referralMonthlyGoalThb:
        Number.isFinite(rawReferralMonthlyGoalThb) && rawReferralMonthlyGoalThb > 0
          ? Math.round(rawReferralMonthlyGoalThb * 100) / 100
          : 10000,
      walletMaxDiscountPercent:
        Number.isFinite(rawWalletMaxDiscountPercent) &&
        rawWalletMaxDiscountPercent >= 0 &&
        rawWalletMaxDiscountPercent <= 100
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
  try {
    const body = await request.json()
    const {
      defaultCommissionRate,
      taxRatePercent,
      guestServiceFeePercent,
      hostCommissionPercent,
      insuranceFundPercent,
      referralReinvestmentPercent,
      referralSplitRatio,
      acquiringFeePercent,
      operationalReservePercent,
      marketingPromoPot,
      promoBoostPerBooking,
      promoTurboModeEnabled,
      organicToPromoPotPercent,
      referralBoostAllocationRule,
      partnerActivationBonus,
      mlmLevel1Percent,
      mlmLevel2Percent,
      payoutToInternalRatio,
      welcomeBonusAmount,
      referralMonthlyGoalThb,
      walletMaxDiscountPercent,
      settlementPayoutDelayDays,
      settlementPayoutHourLocal,
      chatInvoiceRateMultiplier,
      maintenanceMode,
      heroTitle,
      heroSubtitle,
      sitePhone,
      chatSafety: chatSafetyBody,
    } = body
    
    const supabase = getSupabaseClient()
    
    // If Supabase is not configured, update mock settings
    if (!supabase) {
      console.log('[SETTINGS] Supabase not configured, updating mock settings')
      const parsedMock = parseFloat(defaultCommissionRate)
      const parsedMockChat =
        chatInvoiceRateMultiplier != null && chatInvoiceRateMultiplier !== ''
          ? parseFloat(chatInvoiceRateMultiplier)
          : NaN
      const prevChat = parseFloat(mockSettings.chatInvoiceRateMultiplier)
      const nextChatMult =
        Number.isFinite(parsedMockChat) && parsedMockChat >= 1 && parsedMockChat <= 1.5
          ? parsedMockChat
          : Number.isFinite(prevChat) && prevChat >= 1 && prevChat <= 1.5
            ? prevChat
            : platformDefaultChatInvoiceRateMultiplier()
      const nextChatSafety = {
        ...mockSettings.chatSafety,
        ...(chatSafetyBody && typeof chatSafetyBody === 'object' ? chatSafetyBody : {}),
      }
      nextChatSafety.autoShadowbanEnabled = nextChatSafety.autoShadowbanEnabled === true
      const st = parseInt(String(nextChatSafety.strikeThreshold ?? ''), 10)
      nextChatSafety.strikeThreshold =
        Number.isFinite(st) && st >= 1 && st <= 999 ? st : defaultChatSafety.strikeThreshold
      const est = parseFloat(String(nextChatSafety.estimatedBookingValueThb ?? ''))
      nextChatSafety.estimatedBookingValueThb =
        Number.isFinite(est) && est >= 0 ? est : defaultChatSafety.estimatedBookingValueThb
      const mockPartnerActivationBonus = (() => {
        const n = asNumber(partnerActivationBonus ?? body?.partner_activation_bonus)
        return Number.isFinite(n) && n >= 0 ? n : mockSettings.partnerActivationBonus ?? 500
      })()
      const mockMlmLevel1Percent = (() => {
        const n = asNumber(mlmLevel1Percent ?? body?.mlm_level1_percent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.mlmLevel1Percent ?? 70
      })()
      const mockMlmLevel2Percent = (() => {
        const n = asNumber(mlmLevel2Percent ?? body?.mlm_level2_percent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.mlmLevel2Percent ?? 30
      })()
      const mockPayoutToInternalRatio = (() => {
        const n = asNumber(payoutToInternalRatio ?? body?.payout_to_internal_ratio)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.payoutToInternalRatio ?? 70
      })()
      const mockAcquiring = (() => {
        const n = asNumber(acquiringFeePercent ?? body?.acquiring_fee_percent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.acquiringFeePercent ?? 0
      })()
      const mockOperational = (() => {
        const n = asNumber(operationalReservePercent ?? body?.operational_reserve_percent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.operationalReservePercent ?? 0
      })()
      const mockReferralReinvestment = (() => {
        const n = asNumber(referralReinvestmentPercent ?? body?.referral_reinvestment_percent)
        return Number.isFinite(n) && n >= 0 && n <= 95 ? n : mockSettings.referralReinvestmentPercent
      })()
      const mockTaxRate = (() => {
        const n = asNumber(taxRatePercent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.taxRatePercent ?? 0
      })()
      const mockGuestFee = (() => {
        const n = asNumber(guestServiceFeePercent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.guestServiceFeePercent
      })()
      const mockHostFee = (() => {
        const n = asNumber(hostCommissionPercent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.hostCommissionPercent
      })()
      const mockInsurance = (() => {
        const n = asNumber(insuranceFundPercent)
        return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.insuranceFundPercent
      })()
      const mockGuard = buildReferralSafetyGuard({
        guestServiceFeePercent: mockGuestFee,
        hostCommissionPercent: mockHostFee,
        insuranceFundPercent: mockInsurance,
        acquiringFeePercent: mockAcquiring,
        operationalReservePercent: mockOperational,
        taxRatePercent: mockTaxRate,
        referralReinvestmentPercent: mockReferralReinvestment,
        mlmLevel1Percent: mockMlmLevel1Percent,
        mlmLevel2Percent: mockMlmLevel2Percent,
      })
      if (!mockGuard.ok) {
        return NextResponse.json(
          { success: false, error: 'SAFETY_GATE_REJECTED', details: mockGuard.errors, budget: mockGuard.budget },
          { status: 400 },
        )
      }

      mockSettings = {
        ...mockSettings,
        defaultCommissionRate: Number.isFinite(parsedMock) && parsedMock >= 0
          ? parsedMock
          : await resolveDefaultCommissionPercent(),
        taxRatePercent: (() => {
          const n = parseFloat(taxRatePercent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.taxRatePercent ?? 0
        })(),
        guestServiceFeePercent: (() => {
          const n = parseFloat(guestServiceFeePercent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.guestServiceFeePercent
        })(),
        hostCommissionPercent: (() => {
          const n = parseFloat(hostCommissionPercent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.hostCommissionPercent
        })(),
        insuranceFundPercent: (() => {
          const n = parseFloat(insuranceFundPercent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.insuranceFundPercent
        })(),
        referralReinvestmentPercent: mockReferralReinvestment,
        referralSplitRatio: (() => {
          const n = parseFloat(referralSplitRatio)
          return Number.isFinite(n) && n >= 0 && n <= 1 ? n : mockSettings.referralSplitRatio
        })(),
        acquiringFeePercent: mockAcquiring,
        operationalReservePercent: mockOperational,
        marketingPromoPot: (() => {
          const n = parseFloat(marketingPromoPot ?? body?.marketing_promo_pot)
          return Number.isFinite(n) && n >= 0 ? n : mockSettings.marketingPromoPot ?? 0
        })(),
        promoBoostPerBooking: (() => {
          const n = parseFloat(promoBoostPerBooking ?? body?.promo_boost_per_booking)
          return Number.isFinite(n) && n >= 0 ? n : mockSettings.promoBoostPerBooking ?? 0
        })(),
        promoTurboModeEnabled:
          promoTurboModeEnabled === true || body?.promo_turbo_mode_enabled === true,
        organicToPromoPotPercent: (() => {
          const n = parseFloat(organicToPromoPotPercent ?? body?.organic_to_promo_pot_percent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.organicToPromoPotPercent ?? 0
        })(),
        referralBoostAllocationRule: (() => {
          const r = String(
            referralBoostAllocationRule ?? body?.referral_boost_allocation_rule ?? mockSettings.referralBoostAllocationRule ?? 'split_50_50',
          ).toLowerCase()
          return r === '100_to_referrer' || r === '100_to_referee' || r === 'split_50_50'
            ? r
            : 'split_50_50'
        })(),
        partnerActivationBonus: mockPartnerActivationBonus,
        mlmLevel1Percent: mockMlmLevel1Percent,
        mlmLevel2Percent: mockMlmLevel2Percent,
        payoutToInternalRatio: mockPayoutToInternalRatio,
        welcomeBonusAmount: (() => {
          const n = parseFloat(welcomeBonusAmount ?? body?.welcome_bonus_amount)
          return Number.isFinite(n) && n >= 0 ? n : mockSettings.welcomeBonusAmount ?? 0
        })(),
        referralMonthlyGoalThb: (() => {
          const n = parseFloat(referralMonthlyGoalThb ?? body?.referral_monthly_goal_thb)
          return Number.isFinite(n) && n > 0 && n <= 999999999 ? Math.round(n * 100) / 100 : mockSettings.referralMonthlyGoalThb ?? 10000
        })(),
        walletMaxDiscountPercent: (() => {
          const n = parseFloat(walletMaxDiscountPercent ?? body?.wallet_max_discount_percent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.walletMaxDiscountPercent ?? 30
        })(),
        settlementPayoutDelayDays: (() => {
          const n = parseInt(String(settlementPayoutDelayDays ?? ''), 10)
          return Number.isFinite(n) && n >= 0 && n <= 60 ? n : mockSettings.settlementPayoutDelayDays
        })(),
        settlementPayoutHourLocal: (() => {
          const n = parseInt(String(settlementPayoutHourLocal ?? ''), 10)
          return Number.isFinite(n) && n >= 0 && n <= 23 ? n : mockSettings.settlementPayoutHourLocal
        })(),
        chatInvoiceRateMultiplier: nextChatMult,
        maintenanceMode: !!maintenanceMode,
        heroTitle: heroTitle || '',
        heroSubtitle: heroSubtitle || '',
        sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
        chatSafety: nextChatSafety,
      }
      return NextResponse.json({ success: true, data: mockSettings })
    }

    // First check if the row exists
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id, value')
      .eq('key', 'general')
      .single()

    const parsedPut = parseFloat(defaultCommissionRate)
    const parsedTaxRate = parseFloat(taxRatePercent)
    const parsedGuestFee = parseFloat(guestServiceFeePercent)
    const parsedHostCommission = parseFloat(hostCommissionPercent)
    const parsedInsurance = parseFloat(insuranceFundPercent)
    const parsedReferralReinvestment = parseFloat(
      referralReinvestmentPercent ?? body?.referral_reinvestment_percent,
    )
    const parsedReferralSplitRatio = parseFloat(referralSplitRatio ?? body?.referral_split_ratio)
    const parsedAcquiringFeePercent = parseFloat(acquiringFeePercent ?? body?.acquiring_fee_percent)
    const parsedOperationalReservePercent = parseFloat(
      operationalReservePercent ?? body?.operational_reserve_percent,
    )
    const parsedMarketingPromoPot = parseFloat(marketingPromoPot ?? body?.marketing_promo_pot)
    const parsedPromoBoostPerBooking = parseFloat(promoBoostPerBooking ?? body?.promo_boost_per_booking)
    const parsedOrganicToPromoPotPercent = parseFloat(
      organicToPromoPotPercent ?? body?.organic_to_promo_pot_percent,
    )
    const parsedWelcomeBonusAmount = parseFloat(welcomeBonusAmount ?? body?.welcome_bonus_amount)
    const parsedWalletMaxDiscountPercent = parseFloat(
      walletMaxDiscountPercent ?? body?.wallet_max_discount_percent,
    )
    const parsedBoostAllocationRule = String(
      referralBoostAllocationRule ?? body?.referral_boost_allocation_rule ?? '',
    ).toLowerCase()
    const parsedPartnerActivationBonus = asNumber(
      partnerActivationBonus ?? body?.partner_activation_bonus,
    )
    const parsedMlmLevel1Percent = asNumber(mlmLevel1Percent ?? body?.mlm_level1_percent)
    const parsedMlmLevel2Percent = asNumber(mlmLevel2Percent ?? body?.mlm_level2_percent)
    const parsedPayoutToInternalRatio = asNumber(
      payoutToInternalRatio ?? body?.payout_to_internal_ratio,
    )
    const parsedDelayDays = parseInt(String(settlementPayoutDelayDays ?? ''), 10)
    const parsedPayoutHour = parseInt(String(settlementPayoutHourLocal ?? ''), 10)
    const parsedReferralMonthlyGoalThb = parseFloat(
      referralMonthlyGoalThb ?? body?.referral_monthly_goal_thb ?? '',
    )
    const resolvedComm = Number.isFinite(parsedPut) && parsedPut >= 0
      ? parsedPut
      : await resolveDefaultCommissionPercent()
    const resolvedTaxRate =
      Number.isFinite(parsedTaxRate) && parsedTaxRate >= 0 && parsedTaxRate <= 100
        ? parsedTaxRate
        : Number.isFinite(parseFloat(existing?.value?.taxRatePercent))
          ? parseFloat(existing?.value?.taxRatePercent)
          : 0
    const resolvedGuestFee =
      Number.isFinite(parsedGuestFee) && parsedGuestFee >= 0 && parsedGuestFee <= 100
        ? parsedGuestFee
        : Number.isFinite(parseFloat(existing?.value?.guestServiceFeePercent))
          ? parseFloat(existing?.value?.guestServiceFeePercent)
          : 5
    const resolvedHostCommission =
      Number.isFinite(parsedHostCommission) && parsedHostCommission >= 0 && parsedHostCommission <= 100
        ? parsedHostCommission
        : Number.isFinite(parseFloat(existing?.value?.hostCommissionPercent))
          ? parseFloat(existing?.value?.hostCommissionPercent)
          : 0
    const resolvedInsurance =
      Number.isFinite(parsedInsurance) && parsedInsurance >= 0 && parsedInsurance <= 100
        ? parsedInsurance
        : Number.isFinite(parseFloat(existing?.value?.insuranceFundPercent))
          ? parseFloat(existing?.value?.insuranceFundPercent)
          : 0.5
    const resolvedReferralReinvestment =
      Number.isFinite(parsedReferralReinvestment) &&
      parsedReferralReinvestment >= 0 &&
      parsedReferralReinvestment <= 95
        ? parsedReferralReinvestment
        : Number.isFinite(parseFloat(existing?.value?.referral_reinvestment_percent))
          ? parseFloat(existing?.value?.referral_reinvestment_percent)
          : Number.isFinite(parseFloat(existing?.value?.referralReinvestmentPercent))
            ? parseFloat(existing?.value?.referralReinvestmentPercent)
            : 70
    const resolvedReferralSplitRatio =
      Number.isFinite(parsedReferralSplitRatio) &&
      parsedReferralSplitRatio >= 0 &&
      parsedReferralSplitRatio <= 1
        ? parsedReferralSplitRatio
        : Number.isFinite(parseFloat(existing?.value?.referral_split_ratio))
          ? parseFloat(existing?.value?.referral_split_ratio)
          : Number.isFinite(parseFloat(existing?.value?.referralSplitRatio))
            ? parseFloat(existing?.value?.referralSplitRatio)
            : 0.5
    const resolvedAcquiringFeePercent =
      Number.isFinite(parsedAcquiringFeePercent) &&
      parsedAcquiringFeePercent >= 0 &&
      parsedAcquiringFeePercent <= 100
        ? parsedAcquiringFeePercent
        : Number.isFinite(parseFloat(existing?.value?.acquiring_fee_percent))
          ? parseFloat(existing?.value?.acquiring_fee_percent)
          : Number.isFinite(parseFloat(existing?.value?.acquiringFeePercent))
            ? parseFloat(existing?.value?.acquiringFeePercent)
            : 0
    const resolvedOperationalReservePercent =
      Number.isFinite(parsedOperationalReservePercent) &&
      parsedOperationalReservePercent >= 0 &&
      parsedOperationalReservePercent <= 100
        ? parsedOperationalReservePercent
        : Number.isFinite(parseFloat(existing?.value?.operational_reserve_percent))
          ? parseFloat(existing?.value?.operational_reserve_percent)
          : Number.isFinite(parseFloat(existing?.value?.operationalReservePercent))
            ? parseFloat(existing?.value?.operationalReservePercent)
            : 0
    const resolvedMarketingPromoPot =
      Number.isFinite(parsedMarketingPromoPot) && parsedMarketingPromoPot >= 0
        ? parsedMarketingPromoPot
        : Number.isFinite(parseFloat(existing?.value?.marketing_promo_pot))
          ? parseFloat(existing?.value?.marketing_promo_pot)
          : Number.isFinite(parseFloat(existing?.value?.marketingPromoPot))
            ? parseFloat(existing?.value?.marketingPromoPot)
            : 0
    const resolvedPromoBoostPerBooking =
      Number.isFinite(parsedPromoBoostPerBooking) && parsedPromoBoostPerBooking >= 0
        ? parsedPromoBoostPerBooking
        : Number.isFinite(parseFloat(existing?.value?.promo_boost_per_booking))
          ? parseFloat(existing?.value?.promo_boost_per_booking)
          : Number.isFinite(parseFloat(existing?.value?.promoBoostPerBooking))
            ? parseFloat(existing?.value?.promoBoostPerBooking)
            : 0
    const resolvedPromoTurboModeEnabled =
      promoTurboModeEnabled === true || body?.promo_turbo_mode_enabled === true
        ? true
        : promoTurboModeEnabled === false || body?.promo_turbo_mode_enabled === false
          ? false
          : existing?.value?.promo_turbo_mode_enabled === true || existing?.value?.promoTurboModeEnabled === true
    const resolvedOrganicToPromoPotPercent =
      Number.isFinite(parsedOrganicToPromoPotPercent) &&
      parsedOrganicToPromoPotPercent >= 0 &&
      parsedOrganicToPromoPotPercent <= 100
        ? parsedOrganicToPromoPotPercent
        : Number.isFinite(parseFloat(existing?.value?.organic_to_promo_pot_percent))
          ? parseFloat(existing?.value?.organic_to_promo_pot_percent)
          : Number.isFinite(parseFloat(existing?.value?.organicToPromoPotPercent))
            ? parseFloat(existing?.value?.organicToPromoPotPercent)
            : 0
    const resolvedReferralBoostAllocationRule =
      parsedBoostAllocationRule === '100_to_referrer' ||
      parsedBoostAllocationRule === '100_to_referee' ||
      parsedBoostAllocationRule === 'split_50_50'
        ? parsedBoostAllocationRule
        : String(
            existing?.value?.referral_boost_allocation_rule ??
              existing?.value?.referralBoostAllocationRule ??
              'split_50_50',
          ).toLowerCase()
    const resolvedWelcomeBonusAmount =
      Number.isFinite(parsedWelcomeBonusAmount) && parsedWelcomeBonusAmount >= 0
        ? parsedWelcomeBonusAmount
        : Number.isFinite(parseFloat(existing?.value?.welcome_bonus_amount))
          ? parseFloat(existing?.value?.welcome_bonus_amount)
          : Number.isFinite(parseFloat(existing?.value?.welcomeBonusAmount))
            ? parseFloat(existing?.value?.welcomeBonusAmount)
            : 0
    const resolvedWalletMaxDiscountPercent =
      Number.isFinite(parsedWalletMaxDiscountPercent) &&
      parsedWalletMaxDiscountPercent >= 0 &&
      parsedWalletMaxDiscountPercent <= 100
        ? parsedWalletMaxDiscountPercent
        : Number.isFinite(parseFloat(existing?.value?.wallet_max_discount_percent))
          ? parseFloat(existing?.value?.wallet_max_discount_percent)
          : Number.isFinite(parseFloat(existing?.value?.walletMaxDiscountPercent))
            ? parseFloat(existing?.value?.walletMaxDiscountPercent)
            : 30
    const resolvedPartnerActivationBonus =
      Number.isFinite(parsedPartnerActivationBonus) && parsedPartnerActivationBonus >= 0
        ? parsedPartnerActivationBonus
        : Number.isFinite(parseFloat(existing?.value?.partner_activation_bonus))
          ? parseFloat(existing?.value?.partner_activation_bonus)
          : Number.isFinite(parseFloat(existing?.value?.partnerActivationBonus))
            ? parseFloat(existing?.value?.partnerActivationBonus)
            : 500
    const resolvedMlmLevel1Percent =
      Number.isFinite(parsedMlmLevel1Percent) &&
      parsedMlmLevel1Percent >= 0 &&
      parsedMlmLevel1Percent <= 100
        ? parsedMlmLevel1Percent
        : Number.isFinite(parseFloat(existing?.value?.mlm_level1_percent))
          ? parseFloat(existing?.value?.mlm_level1_percent)
          : Number.isFinite(parseFloat(existing?.value?.mlmLevel1Percent))
            ? parseFloat(existing?.value?.mlmLevel1Percent)
            : 70
    const resolvedMlmLevel2Percent =
      Number.isFinite(parsedMlmLevel2Percent) &&
      parsedMlmLevel2Percent >= 0 &&
      parsedMlmLevel2Percent <= 100
        ? parsedMlmLevel2Percent
        : Number.isFinite(parseFloat(existing?.value?.mlm_level2_percent))
          ? parseFloat(existing?.value?.mlm_level2_percent)
          : Number.isFinite(parseFloat(existing?.value?.mlmLevel2Percent))
            ? parseFloat(existing?.value?.mlmLevel2Percent)
            : 30
    const resolvedPayoutToInternalRatio =
      Number.isFinite(parsedPayoutToInternalRatio) &&
      parsedPayoutToInternalRatio >= 0 &&
      parsedPayoutToInternalRatio <= 100
        ? parsedPayoutToInternalRatio
        : Number.isFinite(parseFloat(existing?.value?.payout_to_internal_ratio))
          ? parseFloat(existing?.value?.payout_to_internal_ratio)
          : Number.isFinite(parseFloat(existing?.value?.payoutToInternalRatio))
            ? parseFloat(existing?.value?.payoutToInternalRatio)
            : 70
    const resolvedPayoutDelayDays =
      Number.isFinite(parsedDelayDays) && parsedDelayDays >= 0 && parsedDelayDays <= 60
        ? parsedDelayDays
        : Number.isFinite(parseInt(String(existing?.value?.settlementPayoutDelayDays ?? ''), 10))
          ? parseInt(String(existing?.value?.settlementPayoutDelayDays ?? ''), 10)
          : 1
    const resolvedPayoutHourLocal =
      Number.isFinite(parsedPayoutHour) && parsedPayoutHour >= 0 && parsedPayoutHour <= 23
        ? parsedPayoutHour
        : Number.isFinite(parseInt(String(existing?.value?.settlementPayoutHourLocal ?? ''), 10))
          ? parseInt(String(existing?.value?.settlementPayoutHourLocal ?? ''), 10)
          : 18
    const resolvedReferralMonthlyGoalThb =
      Number.isFinite(parsedReferralMonthlyGoalThb) &&
      parsedReferralMonthlyGoalThb > 0 &&
      parsedReferralMonthlyGoalThb <= 999999999
        ? Math.round(parsedReferralMonthlyGoalThb * 100) / 100
        : Number.isFinite(parseFloat(existing?.value?.referral_monthly_goal_thb))
          ? parseFloat(existing?.value?.referral_monthly_goal_thb)
          : Number.isFinite(parseFloat(existing?.value?.referralMonthlyGoalThb))
            ? parseFloat(existing?.value?.referralMonthlyGoalThb)
            : 10000
    const parsedChat =
      chatInvoiceRateMultiplier != null && chatInvoiceRateMultiplier !== ''
        ? parseFloat(chatInvoiceRateMultiplier)
        : NaN
    const existingChat = parseFloat(existing?.value?.chatInvoiceRateMultiplier)
    const resolvedChatMult =
      Number.isFinite(parsedChat) && parsedChat >= 1 && parsedChat <= 1.5
        ? parsedChat
        : Number.isFinite(existingChat) && existingChat >= 1 && existingChat <= 1.5
          ? existingChat
          : platformDefaultChatInvoiceRateMultiplier()
    const prevCs = existing?.value?.chatSafety || {}
    const mergedCs = {
      ...defaultChatSafety,
      ...prevCs,
      ...(chatSafetyBody && typeof chatSafetyBody === 'object' ? chatSafetyBody : {}),
    }
    mergedCs.autoShadowbanEnabled = mergedCs.autoShadowbanEnabled === true
    const stPut = parseInt(String(mergedCs.strikeThreshold ?? ''), 10)
    mergedCs.strikeThreshold =
      Number.isFinite(stPut) && stPut >= 1 && stPut <= 999 ? stPut : defaultChatSafety.strikeThreshold
    const estPut = parseFloat(String(mergedCs.estimatedBookingValueThb ?? ''))
    mergedCs.estimatedBookingValueThb =
      Number.isFinite(estPut) && estPut >= 0 ? estPut : defaultChatSafety.estimatedBookingValueThb
    const safetyGuard = buildReferralSafetyGuard({
      guestServiceFeePercent: resolvedGuestFee,
      hostCommissionPercent: resolvedHostCommission,
      insuranceFundPercent: resolvedInsurance,
      acquiringFeePercent: resolvedAcquiringFeePercent,
      operationalReservePercent: resolvedOperationalReservePercent,
      taxRatePercent: resolvedTaxRate,
      referralReinvestmentPercent: resolvedReferralReinvestment,
      mlmLevel1Percent: resolvedMlmLevel1Percent,
      mlmLevel2Percent: resolvedMlmLevel2Percent,
    })
    if (!safetyGuard.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'SAFETY_GATE_REJECTED',
          details: safetyGuard.errors,
          budget: safetyGuard.budget,
        },
        { status: 400 },
      )
    }

    const newValue = {
      ...(existing?.value || {}),
      defaultCommissionRate: resolvedComm,
      taxRatePercent: resolvedTaxRate,
      guestServiceFeePercent: resolvedGuestFee,
      hostCommissionPercent: resolvedHostCommission,
      insuranceFundPercent: resolvedInsurance,
      referral_reinvestment_percent: resolvedReferralReinvestment,
      referral_split_ratio: resolvedReferralSplitRatio,
      acquiring_fee_percent: resolvedAcquiringFeePercent,
      operational_reserve_percent: resolvedOperationalReservePercent,
      marketing_promo_pot: resolvedMarketingPromoPot,
      promo_boost_per_booking: resolvedPromoBoostPerBooking,
      promo_turbo_mode_enabled: resolvedPromoTurboModeEnabled === true,
      organic_to_promo_pot_percent: resolvedOrganicToPromoPotPercent,
      referral_boost_allocation_rule: resolvedReferralBoostAllocationRule,
      partnerActivationBonus: resolvedPartnerActivationBonus,
      mlmLevel1Percent: resolvedMlmLevel1Percent,
      mlmLevel2Percent: resolvedMlmLevel2Percent,
      payoutToInternalRatio: resolvedPayoutToInternalRatio,
      partner_activation_bonus: resolvedPartnerActivationBonus,
      mlm_level1_percent: resolvedMlmLevel1Percent,
      mlm_level2_percent: resolvedMlmLevel2Percent,
      payout_to_internal_ratio: resolvedPayoutToInternalRatio,
      welcome_bonus_amount: resolvedWelcomeBonusAmount,
      referralMonthlyGoalThb: resolvedReferralMonthlyGoalThb,
      referral_monthly_goal_thb: resolvedReferralMonthlyGoalThb,
      wallet_max_discount_percent: resolvedWalletMaxDiscountPercent,
      settlementPayoutDelayDays: resolvedPayoutDelayDays,
      settlementPayoutHourLocal: resolvedPayoutHourLocal,
      serviceFeePercent: resolvedGuestFee,
      chatInvoiceRateMultiplier: resolvedChatMult,
      maintenanceMode: !!maintenanceMode,
      heroTitle: heroTitle || '',
      heroSubtitle: heroSubtitle || '',
      sitePhone: typeof sitePhone === 'string' ? sitePhone.trim() : '',
      chatSafety: mergedCs,
    }

    let result
    if (existing) {
      // Update existing row
      result = await supabase
        .from('system_settings')
        .update({ 
          value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'general')
    } else {
      // Insert new row
      result = await supabase
        .from('system_settings')
        .insert({
          id: `setting-${Date.now()}`,
          key: 'general',
          value: newValue,
          updated_at: new Date().toISOString()
        })
    }

    if (result.error) {
      console.error('Failed to save settings:', result.error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      data: newValue
    })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
