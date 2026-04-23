import { supabaseAdmin } from '@/lib/supabase'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { BookingStatus } from './constants.js'
import { extractSettlementSnapshot } from './utils.js'

export async function getPartnerBalance(partnerId) {
  try {
    const fallbackPct = await resolveDefaultCommissionPercent()
    const fallbackRatio = fallbackPct / 100

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('price_thb, commission_thb, partner_earnings_thb, commission_rate, status, pricing_snapshot')
      .eq('partner_id', partnerId)

    let totalEarnings = 0
    let totalCommission = 0
    let escrowBalance = 0
    let availableBalance = 0
    let pendingPayouts = 0

    ;(bookings || []).forEach((b) => {
      const settlement = extractSettlementSnapshot(b)
      const price = parseFloat(b.price_thb) || 0
      const cr = parseFloat(b.commission_rate)
      const ratio = Number.isFinite(cr) && cr >= 0 ? cr / 100 : fallbackRatio
      const comm = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
        ? parseFloat(settlement.platform_margin.thb)
        : parseFloat(b.commission_thb) || price * ratio
      const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
        ? parseFloat(settlement.partner_net.thb)
        : parseFloat(b.partner_earnings_thb) || price - comm

      if (b.status === BookingStatus.COMPLETED) {
        totalEarnings += net
        totalCommission += comm
      } else if (b.status === BookingStatus.PAID_ESCROW) {
        totalEarnings += net
        totalCommission += comm
        escrowBalance += net
        pendingPayouts += net
      } else if (b.status === BookingStatus.THAWED) {
        totalEarnings += net
        totalCommission += comm
        availableBalance += net
      }
    })

    return {
      success: true,
      balance: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        escrowBalance: Math.round(escrowBalance * 100) / 100,
        frozenBalanceThb: Math.round(escrowBalance * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        availableBalanceThb: Math.round(availableBalance * 100) / 100,
        pendingPayouts: Math.round(pendingPayouts * 100) / 100,
      },
    }
  } catch (error) {
    console.error('[BALANCE] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function syncPartnerBalanceColumns(partnerId) {
  if (!partnerId) return { success: false, error: 'missing partner' }
  const { success, balance } = await getPartnerBalance(partnerId)
  if (!success || !balance) return { success: false, error: 'balance' }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      frozen_balance_thb: balance.frozenBalanceThb ?? balance.escrowBalance ?? 0,
      available_balance_thb: balance.availableBalanceThb ?? balance.availableBalance ?? 0,
    })
    .eq('id', partnerId)
  if (error) {
    console.error('[BALANCE SYNC]', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function getPartnerBalanceByCategory(partnerId) {
  const fallbackPct = await resolveDefaultCommissionPercent()
  const fallbackRatio = fallbackPct / 100
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      status,
      partner_earnings_thb,
      price_thb,
      commission_thb,
      commission_rate,
      pricing_snapshot,
      listing:listings(category_id)
    `,
    )
    .eq('partner_id', partnerId)
    .in('status', [BookingStatus.PAID_ESCROW, BookingStatus.THAWED])
  if (error) {
    return { success: false, error: error.message, byCategory: {} }
  }
  const slugCache = new Map()
  const byCategory = {}
  for (const b of bookings || []) {
    const settlement = extractSettlementSnapshot(b)
    const price = parseFloat(b.price_thb) || 0
    const cr = parseFloat(b.commission_rate)
    const ratio = Number.isFinite(cr) && cr >= 0 ? cr / 100 : fallbackRatio
    const comm = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
      ? parseFloat(settlement.platform_margin.thb)
      : parseFloat(b.commission_thb) || price * ratio
    const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
      ? parseFloat(settlement.partner_net.thb)
      : parseFloat(b.partner_earnings_thb) || price - comm
    const cid = b.listing?.category_id
    let slug = 'unknown'
    if (cid) {
      if (slugCache.has(cid)) slug = slugCache.get(cid)
      else {
        slug = (await resolveListingCategorySlug(cid)) || 'unknown'
        slugCache.set(cid, slug)
      }
    }
    const key = String(slug || 'unknown').toLowerCase()
    if (!byCategory[key]) {
      byCategory[key] = { frozenThb: 0, availableThb: 0, labelSlug: key }
    }
    if (b.status === BookingStatus.PAID_ESCROW) {
      byCategory[key].frozenThb += net
    } else if (b.status === BookingStatus.THAWED) {
      byCategory[key].availableThb += net
    }
  }
  for (const k of Object.keys(byCategory)) {
    byCategory[k].frozenThb = Math.round(byCategory[k].frozenThb * 100) / 100
    byCategory[k].availableThb = Math.round(byCategory[k].availableThb * 100) / 100
  }
  return { success: true, byCategory }
}
