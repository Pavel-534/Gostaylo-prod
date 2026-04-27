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
  welcomeBonusAmount: 0,
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
    const rawWalletMaxDiscountPercent = parseFloat(
      data.value?.wallet_max_discount_percent ?? data.value?.walletMaxDiscountPercent,
    )
    const rawBoostRule = String(
      data.value?.referral_boost_allocation_rule ?? data.value?.referralBoostAllocationRule ?? 'split_50_50',
    ).toLowerCase()
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
      welcomeBonusAmount:
        Number.isFinite(rawWelcomeBonusAmount) && rawWelcomeBonusAmount >= 0 ? rawWelcomeBonusAmount : 0,
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
      welcomeBonusAmount,
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
        referralReinvestmentPercent: (() => {
          const n = parseFloat(referralReinvestmentPercent)
          return Number.isFinite(n) && n >= 0 && n <= 95 ? n : mockSettings.referralReinvestmentPercent
        })(),
        referralSplitRatio: (() => {
          const n = parseFloat(referralSplitRatio)
          return Number.isFinite(n) && n >= 0 && n <= 1 ? n : mockSettings.referralSplitRatio
        })(),
        acquiringFeePercent: (() => {
          const n = parseFloat(acquiringFeePercent ?? body?.acquiring_fee_percent)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : mockSettings.acquiringFeePercent ?? 0
        })(),
        operationalReservePercent: (() => {
          const n = parseFloat(operationalReservePercent ?? body?.operational_reserve_percent)
          return Number.isFinite(n) && n >= 0 && n <= 100
            ? n
            : mockSettings.operationalReservePercent ?? 0
        })(),
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
        welcomeBonusAmount: (() => {
          const n = parseFloat(welcomeBonusAmount ?? body?.welcome_bonus_amount)
          return Number.isFinite(n) && n >= 0 ? n : mockSettings.welcomeBonusAmount ?? 0
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
    const parsedDelayDays = parseInt(String(settlementPayoutDelayDays ?? ''), 10)
    const parsedPayoutHour = parseInt(String(settlementPayoutHourLocal ?? ''), 10)
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
      welcome_bonus_amount: resolvedWelcomeBonusAmount,
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
