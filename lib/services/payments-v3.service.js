import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'

export const PaymentMethod = {
  USDT_TRC20: 'CRYPTO',
  CARD_INTL: 'CARD',
  CARD_RU: 'MIR',
  THAI_QR: 'CRYPTO',
  CRYPTO: 'CRYPTO',
  CARD: 'CARD',
  MIR: 'MIR',
}

export const PaymentStatus = {
  PENDING: 'PENDING',
  VERIFYING: 'VERIFYING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
}

function normalizeMethod(method) {
  const raw = String(method || '').toUpperCase().trim()
  if (raw === 'USDT_TRC20' || raw === 'THAI_QR') return 'CRYPTO'
  if (raw === 'CARD_INTL') return 'CARD'
  if (raw === 'CARD_RU') return 'MIR'
  if (raw === 'CRYPTO' || raw === 'CARD' || raw === 'MIR') return raw
  return 'CRYPTO'
}

function mapPaymentRow(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    amount: parseFloat(row.amount) || 0,
    currency: row.currency,
    method: row.method,
    status: row.status,
    txId: row.tx_id || null,
    gatewayRef: row.gateway_ref || null,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    booking: row.booking || null,
  }
}

export class PaymentsV3Service {
  static async countPendingPayments() {
    const { count, error } = await supabaseAdmin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', PaymentStatus.PENDING)
    if (error) return { success: false, count: 0, error: error.message }
    return { success: true, count: count || 0 }
  }

  static async getPayments(filters = {}) {
    let query = supabaseAdmin
      .from('payments')
      .select('*, booking:bookings(id, status, listing_id, partner_id, renter_id, price_thb)')
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.paymentMethod) query = query.eq('method', normalizeMethod(filters.paymentMethod))
    if (filters.limit) query = query.limit(Math.max(1, Number(filters.limit)))

    const { data, error } = await query
    if (error) return { success: false, payments: [], error: error.message }
    return { success: true, payments: (data || []).map(mapPaymentRow) }
  }

  static async getPendingPayments(filters = {}) {
    return this.getPayments({ ...filters, status: PaymentStatus.PENDING })
  }

  static async submitTxid(bookingId, txid, paymentMethod = 'CRYPTO') {
    const normalized = normalizeMethod(paymentMethod)
    const now = new Date().toISOString()

    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .update({
          status: PaymentStatus.PENDING,
          tx_id: txid,
          method: normalized,
          metadata: {
            ...(existing.metadata || {}),
            txid_submitted_at: now,
          },
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, payment: mapPaymentRow(data) }
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, price_paid, price_thb, currency')
      .eq('id', bookingId)
      .single()
    if (bookingError || !booking) return { success: false, error: 'Booking not found' }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: booking.price_paid || booking.price_thb,
        currency: booking.currency || 'THB',
        method: normalized,
        status: PaymentStatus.PENDING,
        tx_id: txid,
        metadata: {
          txid_submitted_at: now,
        },
      })
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, payment: mapPaymentRow(data) }
  }

  static async confirmPayment(paymentId, verificationData = {}) {
    const now = new Date().toISOString()
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (fetchError || !payment) return { success: false, error: 'Payment not found' }

    const { data: updated, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: PaymentStatus.CONFIRMED,
        completed_at: now,
        metadata: {
          ...(payment.metadata || {}),
          verification: verificationData,
          verified_at: now,
        },
      })
      .eq('id', paymentId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }

    const escrow = await EscrowService.moveToEscrow(payment.booking_id, {
      ...verificationData,
      payment_id: paymentId,
    })
    if (!escrow?.success) {
      return { success: false, error: escrow?.error || 'Escrow transition failed', payment: mapPaymentRow(updated) }
    }

    return { success: true, payment: mapPaymentRow(updated), escrow: escrow.escrow }
  }

  static async rejectPayment(paymentId, reason = '') {
    const now = new Date().toISOString()
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (fetchError || !payment) return { success: false, error: 'Payment not found' }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: PaymentStatus.FAILED,
        metadata: {
          ...(payment.metadata || {}),
          rejected_at: now,
          rejection_reason: String(reason || '').slice(0, 500),
        },
      })
      .eq('id', paymentId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, payment: mapPaymentRow(data) }
  }

  static async requestPayout(partnerId, amount, method, details = {}) {
    return EscrowService.requestPayout(partnerId, Number(amount), {
      ...details,
      method: normalizeMethod(method),
    })
  }
}

export default PaymentsV3Service
