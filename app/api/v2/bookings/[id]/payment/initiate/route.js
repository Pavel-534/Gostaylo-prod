/**
 * POST /api/bookings/[id]/payment/initiate
 * Stage 2: Payment Intent bridge (invoice -> checkout -> provider adapters).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { supabaseAdmin } from '@/lib/supabase'
import PaymentIntentService from '@/lib/services/payment-intent.service'
import WalletService from '@/lib/services/finance/wallet.service'

export const dynamic = 'force-dynamic'

function normalizeMethod(v) {
  const m = String(v || '').toUpperCase().trim()
  if (m === 'CARD' || m === 'MIR' || m === 'CRYPTO') return m
  return null
}

export async function POST(request, { params }) {
  const bookingId = params.id
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const method = normalizeMethod(body?.method)
    const invoiceId = body?.invoiceId ? String(body.invoiceId) : null
    const walletUseRequestedThb = Number(body?.walletUseThb ?? body?.wallet_use_thb ?? 0)
    if (!method) {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 })
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const sessionUserId = await getUserIdFromSession()
    if (booking.renter_id) {
      if (!sessionUserId) {
        return NextResponse.json({ success: false, error: 'Please log in to complete payment' }, { status: 401 })
      }
      if (String(booking.renter_id) !== String(sessionUserId)) {
        return NextResponse.json({ success: false, error: 'Access denied. This is not your booking.' }, { status: 403 })
      }
    }
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Booking is cancelled' }, { status: 400 })
    }

    let invoice = null
    if (invoiceId) {
      const { data: inv, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('id,booking_id,amount,status,metadata,created_at')
        .eq('id', invoiceId)
        .maybeSingle()
      if (invErr || !inv) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
      }
      if (String(inv.booking_id || '') !== String(bookingId)) {
        return NextResponse.json({ success: false, error: 'Invoice does not belong to booking' }, { status: 400 })
      }
      if (String(inv.status || '').toLowerCase() === 'cancelled') {
        return NextResponse.json({ success: false, error: 'Invoice is cancelled' }, { status: 400 })
      }
      invoice = inv
    }

    let walletUseAppliedThb = 0
    let walletSpendResult = null
    let bookingForIntent = booking
    const existingWalletDiscountThb = Math.max(0, Math.round(Number(booking?.metadata?.wallet_discount_thb || 0)))
    if (existingWalletDiscountThb > 0) {
      walletUseAppliedThb = existingWalletDiscountThb
      bookingForIntent = {
        ...booking,
        commission_thb: Math.max(0, Math.round(Number(booking.commission_thb || 0) - walletUseAppliedThb)),
      }
    }
    if (!invoiceId && walletUseAppliedThb <= 0 && Number.isFinite(walletUseRequestedThb) && walletUseRequestedThb > 0) {
      const policy = await WalletService.getWalletPolicy()
      const maxByPercent = Math.round(
        ((Number(booking.price_thb || 0) + Number(booking.commission_thb || 0) + Number(booking.rounding_diff_pot || 0)) *
          (Number(policy.walletMaxDiscountPercent || 0) / 100)),
      )
      const maxByPlatformFee = Math.max(0, Math.round(Number(booking.commission_thb || 0)))
      walletUseAppliedThb = Math.max(
        0,
        Math.min(Math.round(walletUseRequestedThb), maxByPercent, maxByPlatformFee),
      )
      if (walletUseAppliedThb > 0) {
        const renterId = booking.renter_id || sessionUserId
        const activationGate = await WalletService.assertWalletSpendAllowed(renterId)
        if (!activationGate.ok) {
          return NextResponse.json(
            {
              success: false,
              error: activationGate.error || 'WALLET_ACTIVATION_REQUIRED',
              code: 'WALLET_ACTIVATION_REQUIRED',
            },
            { status: activationGate.status || 403 },
          )
        }
        const spend = await WalletService.spendFunds(
          renterId,
          walletUseAppliedThb,
          bookingId,
          {
            trigger: 'payment_initiate',
            wallet_max_discount_percent: policy.walletMaxDiscountPercent,
          },
        )
        if (!spend.success && spend.error !== 'ALREADY_APPLIED') {
          return NextResponse.json(
            { success: false, error: spend.error || 'WALLET_SPEND_REJECTED' },
            { status: spend.status || 409 },
          )
        }
        walletSpendResult = spend.data || null
        const reducedCommission = Math.max(
          0,
          Math.round(Number(booking.commission_thb || 0) - walletUseAppliedThb),
        )
        bookingForIntent = {
          ...booking,
          commission_thb: reducedCommission,
          metadata: {
            ...(booking.metadata || {}),
            wallet_discount_thb: walletUseAppliedThb,
            wallet_spend_transaction_id: spend?.data?.transactionId || null,
          },
        }
      }
    }

    const intentRes = await PaymentIntentService.resolveOrCreateForCheckout({
      booking: bookingForIntent,
      invoice,
      createdBy: sessionUserId || null,
    })
    if (!intentRes.success || !intentRes.intent) {
      return NextResponse.json({ success: false, error: intentRes.error || 'intent_create_failed' }, { status: 500 })
    }

    const initiated = await PaymentIntentService.initiate(intentRes.intent.id, method, { bookingId })
    if (!initiated.success) {
      const code = initiated.error === 'method_not_allowed' ? 400 : 500
      return NextResponse.json(
        { success: false, error: initiated.error, allowed_methods: initiated.allowed_methods || null },
        { status: code },
      )
    }

    await supabaseAdmin
      .from('bookings')
      .update({
        status: 'AWAITING_PAYMENT',
        metadata: {
          ...(booking.metadata || {}),
          paymentIntentId: initiated.intent.id,
          paymentMethod: initiated.selectedMethod,
          paymentInitiatedAt: new Date().toISOString(),
          invoiceId: invoiceId || null,
          wallet_discount_thb: walletUseAppliedThb > 0 ? walletUseAppliedThb : booking?.metadata?.wallet_discount_thb || 0,
          wallet_spend_transaction_id:
            walletSpendResult?.transactionId || booking?.metadata?.wallet_spend_transaction_id || null,
        },
      })
      .eq('id', bookingId)

    return NextResponse.json({
      success: true,
      data: {
        id: initiated.intent.id,
        intentId: initiated.intent.id,
        bookingId,
        method: initiated.selectedMethod,
        status: initiated.intent.status,
        amountThb: initiated.intent.amountThb,
        currency: initiated.intent.displayCurrency,
        displayAmount: initiated.intent.displayAmount,
        allowedMethods: initiated.intent.allowedMethods,
        provider: initiated.provider,
        checkoutUrl: initiated.checkoutUrl,
        metadata: initiated.providerPayload || null,
        walletUseAppliedThb,
      },
    })
  } catch (error) {
    console.error('[PAYMENT-INITIATE ERROR]', error)
    void notifySystemAlert(
      `💳 <b>Платёж: критическая ошибка initiate</b>\n` +
        `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ success: false, error: 'Failed to initiate payment' }, { status: 500 })
  }
}
