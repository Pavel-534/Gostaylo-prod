/**
 * Commission Rate API
 * GET - Fetch effective commission rate for a partner
 *
 * Query params:
 * - partnerId: Personalized host commission (`custom_commission_rate`) — только для самого партнёра или ADMIN/MODERATOR.
 *
 * Без сессии или при чужом `partnerId`: `partnerId` игнорируется — те же **глобальные** поля (`systemRate`, `personalRate: null`, гостевой сбор и т.д.).
 */

import { NextResponse } from 'next/server'
import {
  resolveDefaultCommissionPercent,
  resolveChatInvoiceRateMultiplier,
  PLATFORM_SPLIT_FEE_DEFAULTS,
} from '@/lib/services/currency.service'
import {
  resolveGuestServiceFeePercentFromGeneral,
  resolveHostCommissionPercentFromGeneral,
} from '@/lib/services/pricing/pricing-fee-policy.js'
import { getSessionPayload } from '@/lib/services/session-service'
import { readSystemSettingValue } from '@/lib/admin/system-settings-store'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const session = await getSessionPayload()

    const { searchParams } = new URL(request.url)
    let partnerIdParam = searchParams.get('partnerId')
    if (partnerIdParam) {
      partnerIdParam = String(partnerIdParam).trim() || null
    }

    if (partnerIdParam) {
      if (!session?.userId) {
        partnerIdParam = null
      } else {
        const role = String(session.role || '').toUpperCase()
        const staff = role === 'ADMIN' || role === 'MODERATOR'
        const self = String(session.userId) === String(partnerIdParam)
        if (!staff && !self) {
          // Не 403 целиком: клиенту всё равно нужны глобальные поля (guest fee, insurance, multiplier).
          // Персональную ставку чужого партнёра не отдаём — как без partnerId.
          partnerIdParam = null
        }
      }
    }

    const general = (await readSystemSettingValue('general')) || {}
    const systemHostRate = resolveHostCommissionPercentFromGeneral(general)
    const guestServiceFeePercent = resolveGuestServiceFeePercentFromGeneral(general)
    const parsedInsurance = parseFloat(general?.insuranceFundPercent)
    const parsedMarkup = parseFloat(general?.chatInvoiceRateMultiplier)
    const systemRate = systemHostRate
    const insuranceFundPercent =
      Number.isFinite(parsedInsurance) && parsedInsurance >= 0 && parsedInsurance <= 100
        ? parsedInsurance
        : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent
    const chatInvoiceRateMultiplier =
      Number.isFinite(parsedMarkup) && parsedMarkup >= 1 && parsedMarkup <= 1.5
        ? parsedMarkup
        : await resolveChatInvoiceRateMultiplier()

    const parsedTax = parseFloat(general?.taxRatePercent)
    const taxRatePercent =
      Number.isFinite(parsedTax) && parsedTax >= 0 && parsedTax <= 100 ? parsedTax : 0

    let personalRate = null
    if (partnerIdParam && supabaseAdmin) {
      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerIdParam)
        .maybeSingle()
      if (profileRow?.custom_commission_rate != null) {
        const p = parseFloat(profileRow.custom_commission_rate)
        if (Number.isFinite(p) && p >= 0 && p <= 100) personalRate = p
      }
    }

    const effectiveRate = personalRate !== null ? personalRate : systemRate

    return NextResponse.json({
      success: true,
      data: {
        systemRate,
        personalRate,
        effectiveRate,
        partnerEarningsPercent: 100 - effectiveRate,
        guestServiceFeePercent,
        hostCommissionPercent: effectiveRate,
        insuranceFundPercent,
        chatInvoiceRateMultiplier,
        taxRatePercent,
      },
    })
  } catch (error) {
    console.error('Commission API error:', error)
    const fallback = await resolveDefaultCommissionPercent()
    return NextResponse.json({
      success: true,
      data: {
        systemRate: fallback,
        personalRate: null,
        effectiveRate: fallback,
        partnerEarningsPercent: 100 - fallback,
        guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
        hostCommissionPercent: fallback,
        insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
        chatInvoiceRateMultiplier: await resolveChatInvoiceRateMultiplier(),
        taxRatePercent: 0,
      },
    })
  }
}
