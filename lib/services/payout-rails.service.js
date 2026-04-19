import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCurrencyCode, PAYOUT_CURRENCIES } from '@/lib/finance/currency-codes'
import { normalizePayoutFeeType } from '@/lib/finance/payout-method-fee'

export const PAYOUT_METHOD_CHANNELS = ['CARD', 'BANK', 'CRYPTO']
export const PAYOUT_FEE_TYPES = ['percentage', 'fixed']

function normalizeChannel(value) {
  const normalized = String(value || 'CARD').toUpperCase().trim()
  return PAYOUT_METHOD_CHANNELS.includes(normalized) ? normalized : 'CARD'
}

function normalizeEmbeddedMethod(method) {
  if (!method || typeof method !== 'object') return method
  return {
    ...method,
    fee_type: normalizePayoutFeeType(method.fee_type ?? method.feeType),
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export class PayoutRailsService {
  static makeMethodId() {
    return makeId('pm')
  }

  static makeProfileId() {
    return makeId('pp')
  }

  static normalizeMethodPayload(payload = {}) {
    const currency = normalizeCurrencyCode(payload.currency || 'THB', 'THB')
    return {
      name: String(payload.name || '').trim(),
      channel: normalizeChannel(payload.channel),
      fee_type: normalizePayoutFeeType(payload.feeType || payload.fee_type),
      value: Number(payload.value) || 0,
      currency: PAYOUT_CURRENCIES.includes(currency) ? currency : 'THB',
      min_payout: Math.max(0, Number(payload.minPayout ?? payload.min_payout) || 0),
      is_active: payload.isActive !== false && payload.is_active !== false,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    }
  }

  static async listPayoutMethods({ activeOnly = false } = {}) {
    let query = supabaseAdmin
      .from('payout_methods')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const rows = data || []
    return rows.map((row) => ({
      ...row,
      fee_type: normalizePayoutFeeType(row.fee_type ?? row.feeType),
    }))
  }

  static async getPayoutMethodById(methodId) {
    if (!methodId) return null
    const { data, error } = await supabaseAdmin
      .from('payout_methods')
      .select('*')
      .eq('id', methodId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      ...data,
      fee_type: normalizePayoutFeeType(data.fee_type ?? data.feeType),
    }
  }

  static async listPartnerPayoutProfiles(partnerId) {
    const { data, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('*, method:payout_methods(*)')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data || []).map((row) => ({
      ...row,
      method: normalizeEmbeddedMethod(row.method),
    }))
  }

  static async getPartnerDefaultPayoutProfile(partnerId) {
    const { data, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('*, method:payout_methods(*)')
      .eq('partner_id', partnerId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      ...data,
      method: normalizeEmbeddedMethod(data.method),
    }
  }

  static calculatePayoutFee(basePayoutAmount, payoutMethod) {
    const base = Math.max(0, Number(basePayoutAmount) || 0)
    const method = payoutMethod || null
    if (!method) {
      return { feeAmount: 0, finalAmount: base, baseAmount: base }
    }

    const value = Math.max(0, Number(method.value) || 0)
    const minPayout = Math.max(0, Number(method.min_payout) || 0)
    if (base < minPayout) {
      return {
        error: `Minimum payout for this method is ${minPayout} ${method.currency || 'THB'}`,
        baseAmount: base,
        feeAmount: 0,
        finalAmount: base,
      }
    }

    const feeType = normalizePayoutFeeType(method.fee_type ?? method.feeType)
    const feeAmount = feeType === 'percentage'
      ? Math.round(base * (value / 100) * 100) / 100
      : Math.round(value * 100) / 100

    const finalAmount = Math.max(0, Math.round((base - feeAmount) * 100) / 100)
    return {
      baseAmount: Math.round(base * 100) / 100,
      feeAmount,
      finalAmount,
      feeType,
      feeValue: value,
      currency: method.currency || 'THB',
      methodId: method.id || null,
      methodName: method.name || null,
      channel: method.channel || null,
      minPayout,
    }
  }
}

export default PayoutRailsService
