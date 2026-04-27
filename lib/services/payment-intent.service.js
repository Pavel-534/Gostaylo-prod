import { supabaseAdmin } from '@/lib/supabase'
import { getEffectiveRate, resolveThbPerUsdt } from '@/lib/services/currency.service'
import { createPaymentSession, resolveAdapterKeyByMethod } from '@/lib/services/payment-adapters'

const ACTIVE_INTENT_STATUSES = ['CREATED', 'INITIATED']
const TERMINAL_INTENT_STATUSES = ['PAID', 'FAILED', 'CANCELLED', 'EXPIRED']

function nowIso() {
  return new Date().toISOString()
}

function genIntentId() {
  return `pi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeMethod(v, fallback = 'CARD') {
  const m = String(v || '').toUpperCase().trim()
  if (m === 'CARD' || m === 'MIR' || m === 'CRYPTO') return m
  return fallback
}

function normalizeCurrency(v, fallback = 'THB') {
  const c = String(v || '').toUpperCase().trim()
  if (c === 'THB' || c === 'USDT' || c === 'USD' || c === 'RUB') return c
  return fallback
}

function normalizeAllowedMethods(raw, preferred) {
  const arr = Array.isArray(raw) ? raw.map((m) => normalizeMethod(m, '')).filter(Boolean) : []
  if (arr.length > 0) return [...new Set(arr)]
  return preferred === 'CRYPTO' ? ['CRYPTO', 'CARD', 'MIR'] : ['CARD', 'MIR', 'CRYPTO']
}

function toIntentRow(row) {
  if (!row) return null
  return {
    id: row.id,
    bookingId: row.booking_id,
    invoiceId: row.invoice_id,
    status: row.status,
    amountThb: Number(row.amount_thb || 0),
    displayAmount: Number(row.display_amount || 0),
    displayCurrency: String(row.display_currency || 'THB').toUpperCase(),
    preferredMethod: String(row.preferred_method || 'CARD').toUpperCase(),
    allowedMethods: Array.isArray(row.allowed_methods) ? row.allowed_methods : [],
    provider: row.provider || null,
    externalRef: row.external_ref || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    initiatedAt: row.initiated_at || null,
    confirmedAt: row.confirmed_at || null,
  }
}

async function convertDisplayToThb(amount, currency) {
  const a = Number(amount || 0)
  if (!Number.isFinite(a) || a <= 0) return 0
  if (currency === 'THB') return Math.round(a)
  const mult = await getEffectiveRate(currency, 'THB')
  return Math.round(a * mult)
}

async function resolveProviderPayload({ method, amountThb, bookingId, intentId, intent }) {
  const selectedMethod = normalizeMethod(method, 'CARD')
  if (selectedMethod === 'CRYPTO') {
    const rate = await resolveThbPerUsdt()
    const amountUsdt = Math.round((Number(amountThb || 0) / rate) * 100) / 100
    return {
      provider: 'CRYPTO_TRON',
      checkoutUrl: null,
      providerPayload: {
        adapter_key: 'crypto-tron',
        network: 'TRC-20',
        amount_usdt: amountUsdt,
        rate_thb_per_usdt: rate,
        // TODO(Stage 3): wire provider adapter + dynamic wallet by environment.
        wallet_address: 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5',
      },
    }
  }

  const adapterKey = resolveAdapterKeyByMethod(selectedMethod)
  const session = await createPaymentSession({
    adapterKey,
    intent: intent || { id: intentId, amountThb: Number(amountThb || 0) },
    bookingId,
  })
  return {
    provider: session.provider || adapterKey,
    checkoutUrl: session.checkoutUrl || null,
    externalRef: session.externalRef || null,
    providerPayload: {
      ...(session.adapterPayload || {}),
      adapter_key: adapterKey,
      booking_id: bookingId,
      amount_thb: Number(amountThb || 0),
    },
  }
}

export class PaymentIntentService {
  static async findActiveByBookingOrInvoice({ bookingId, invoiceId = null }) {
    let q = supabaseAdmin
      .from('payment_intents')
      .select('*')
      .eq('booking_id', bookingId)
      .in('status', ACTIVE_INTENT_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
    if (invoiceId) q = q.eq('invoice_id', invoiceId)
    const { data, error } = await q.maybeSingle()
    if (error) return { success: false, error: error.message, intent: null }
    return { success: true, intent: toIntentRow(data) }
  }

  static async getById(id) {
    const { data, error } = await supabaseAdmin.from('payment_intents').select('*').eq('id', id).maybeSingle()
    if (error) return { success: false, error: error.message, intent: null }
    return { success: true, intent: toIntentRow(data) }
  }

  static async resolveOrCreateForCheckout({ booking, invoice = null, createdBy = null }) {
    const bookingId = String(booking?.id || '')
    if (!bookingId) return { success: false, error: 'booking_required' }
    const invoiceId = invoice?.id ? String(invoice.id) : null

    const existing = await this.findActiveByBookingOrInvoice({ bookingId, invoiceId })
    if (!existing.success) return existing
    if (existing.intent) {
      const expectedWalletDiscount = Math.round(Number(booking?.metadata?.wallet_discount_thb || 0))
      const existingWalletDiscount = Math.round(
        Number(existing.intent?.metadata?.booking_wallet_discount_thb || 0),
      )
      if (invoiceId || expectedWalletDiscount === existingWalletDiscount) {
        return existing
      }
    }

    const invMeta = invoice?.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {}
    const displayCurrency = normalizeCurrency(invoice ? invMeta.currency || 'THB' : 'THB')
    const displayAmount = Number(invoice ? invoice.amount : booking.price_thb) || 0
    const preferredMethod = normalizeMethod(invoice ? invMeta.payment_method : booking?.metadata?.paymentMethod, 'CARD')
    const allowedMethods = normalizeAllowedMethods(invMeta.allowed_payment_methods, preferredMethod)
    const amountThb = invoice
      ? Number(invMeta.amount_thb || 0) > 0
        ? Math.round(Number(invMeta.amount_thb))
        : await convertDisplayToThb(displayAmount, displayCurrency)
      : Math.round(
          (Number(booking.price_thb || 0) || 0) +
            (Number(booking.commission_thb || 0) || 0) +
            (Number(booking.rounding_diff_pot || 0) || 0),
        )

    const expiresAt = invoice?.created_at
      ? new Date(new Date(invoice.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null

    const row = {
      id: genIntentId(),
      booking_id: bookingId,
      invoice_id: invoiceId,
      status: 'CREATED',
      amount_thb: amountThb,
      display_amount: displayAmount,
      display_currency: displayCurrency,
      preferred_method: preferredMethod,
      allowed_methods: allowedMethods,
      provider: null,
      external_ref: null,
      metadata: {
        source: invoice ? 'invoice_checkout' : 'booking_checkout',
        invoice_currency: displayCurrency,
        booking_wallet_discount_thb: Math.round(Number(booking?.metadata?.wallet_discount_thb || 0)),
      },
      expires_at: expiresAt,
      created_by: createdBy || null,
    }

    const { data, error } = await supabaseAdmin.from('payment_intents').insert(row).select('*').single()
    if (error) return { success: false, error: error.message }
    return { success: true, intent: toIntentRow(data) }
  }

  static async initiate(intentId, method, { bookingId = null } = {}) {
    const found = await this.getById(intentId)
    if (!found.success || !found.intent) return { success: false, error: found.error || 'intent_not_found' }
    const intent = found.intent
    const status = String(intent.status || '').toUpperCase()
    if (TERMINAL_INTENT_STATUSES.includes(status)) {
      return { success: false, error: `intent_terminal_${status}` }
    }

    const selectedMethod = normalizeMethod(method, intent.preferredMethod || 'CARD')
    const allowed = Array.isArray(intent.allowedMethods) ? intent.allowedMethods.map((m) => normalizeMethod(m, '')) : []
    if (allowed.length > 0 && !allowed.includes(selectedMethod)) {
      return { success: false, error: 'method_not_allowed', allowed_methods: allowed }
    }

    const provider = await resolveProviderPayload({
      method: selectedMethod,
      amountThb: intent.amountThb,
      bookingId: bookingId || intent.bookingId,
      intentId: intent.id,
      intent,
    })

    const patch = {
      status: 'INITIATED',
      provider: provider.provider,
      external_ref: provider.externalRef || provider.checkoutUrl || null,
      initiated_at: nowIso(),
      metadata: {
        ...(intent.metadata || {}),
        selected_method: selectedMethod,
        provider_payload: provider.providerPayload,
      },
    }
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .update(patch)
      .eq('id', intent.id)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return {
      success: true,
      intent: toIntentRow(data),
      selectedMethod,
      provider: provider.provider,
      checkoutUrl: provider.checkoutUrl,
      providerPayload: provider.providerPayload,
    }
  }

  static async markPaid(intentId, { txId = null, gatewayRef = null, source = 'checkout_confirm', raw = null } = {}) {
    const found = await this.getById(intentId)
    if (!found.success || !found.intent) return { success: false, error: found.error || 'intent_not_found' }
    const intent = found.intent
    const status = String(intent.status || '').toUpperCase()
    if (status === 'PAID') return { success: true, intent, alreadyPaid: true }
    if (TERMINAL_INTENT_STATUSES.includes(status) && status !== 'PAID') {
      return { success: false, error: `intent_terminal_${status}` }
    }
    const patch = {
      status: 'PAID',
      confirmed_at: nowIso(),
      metadata: {
        ...(intent.metadata || {}),
        paid_event: {
          txId: txId || null,
          gatewayRef: gatewayRef || null,
          source,
          at: nowIso(),
          raw: raw || null,
        },
      },
    }
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .update(patch)
      .eq('id', intent.id)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, intent: toIntentRow(data), alreadyPaid: false }
  }
}

export default PaymentIntentService

