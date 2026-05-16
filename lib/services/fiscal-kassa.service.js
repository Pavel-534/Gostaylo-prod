/**
 * 54-FZ online kassa — fiscal receipt preparation & sandbox (Stage 97.0.5).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { toFiscalKassaPayload } from '@/lib/pricing-engine/snapshot-adapter.js'
import { isFiscalSandboxEnabled } from '@/lib/pricing-engine/fiscal-config.js'

export const FISCAL_STATUS = {
  PENDING: 'PENDING_FISCAL',
  ISSUED: 'ISSUED',
  SANDBOX_MOCK: 'SANDBOX_MOCK',
  SKIPPED: 'SKIPPED',
}

function readBreakdownFromBooking(booking) {
  const snap = booking?.pricing_snapshot
  if (!snap || snap.v !== 2) return null
  return snap.final_breakdown || null
}

/**
 * @param {object} booking
 */
export async function issueFiscalReceiptForBooking(booking) {
  const bookingId = booking?.id
  if (!bookingId) return { success: false, error: 'missing_booking_id' }

  const breakdown = readBreakdownFromBooking(booking)
  if (!breakdown) {
    return { success: true, skipped: true, status: FISCAL_STATUS.SKIPPED, reason: 'not_v2_snapshot' }
  }

  const payload = toFiscalKassaPayload(breakdown)
  const meta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
  const fiscalBlock = {
    status: FISCAL_STATUS.PENDING,
    payload,
    attempts: 0,
    updated_at: new Date().toISOString(),
  }

  if (isFiscalSandboxEnabled()) {
    fiscalBlock.status = FISCAL_STATUS.SANDBOX_MOCK
    fiscalBlock.mock_receipt_id = `sandbox-${bookingId}-${Date.now()}`
    fiscalBlock.provider = 'FISCAL_SANDBOX'
    await persistFiscalMetadata(bookingId, meta, fiscalBlock)
    return {
      success: true,
      sandbox: true,
      status: FISCAL_STATUS.SANDBOX_MOCK,
      receiptId: fiscalBlock.mock_receipt_id,
      payload,
    }
  }

  try {
    const receiptId = await submitToFiscalProvider(payload, booking)
    fiscalBlock.status = FISCAL_STATUS.ISSUED
    fiscalBlock.receipt_id = receiptId
    fiscalBlock.provider = process.env.FISCAL_PROVIDER || 'stub'
    await persistFiscalMetadata(bookingId, meta, fiscalBlock)
    return { success: true, status: FISCAL_STATUS.ISSUED, receiptId, payload }
  } catch (err) {
    fiscalBlock.status = FISCAL_STATUS.PENDING
    fiscalBlock.last_error = err?.message || String(err)
    fiscalBlock.attempts = (meta.fiscal?.attempts || 0) + 1
    await persistFiscalMetadata(bookingId, meta, fiscalBlock)
    return {
      success: false,
      status: FISCAL_STATUS.PENDING,
      pending: true,
      error: fiscalBlock.last_error,
      payload,
    }
  }
}

async function persistFiscalMetadata(bookingId, meta, fiscalBlock) {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from('bookings')
    .update({
      metadata: { ...meta, fiscal: fiscalBlock },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
}

/**
 * Provider plug-in (production: ATOL / CloudKassir / etc.).
 * @param {object} payload
 * @param {object} booking
 */
async function submitToFiscalProvider(payload, booking) {
  const url = process.env.FISCAL_PROVIDER_URL
  if (!url) {
    throw new Error('FISCAL_PROVIDER_URL not configured')
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.FISCAL_PROVIDER_TOKEN
        ? `Bearer ${process.env.FISCAL_PROVIDER_TOKEN}`
        : undefined,
    },
    body: JSON.stringify({ booking_id: booking.id, payload }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Fiscal provider HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json().catch(() => ({}))
  return json.receipt_id || json.receiptId || `fiscal-${booking.id}`
}

/**
 * Admin manual retry.
 * @param {string} bookingId
 */
export async function retryPendingFiscalReceipt(bookingId) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()
  if (error || !booking) return { error: 'booking_not_found' }
  return issueFiscalReceiptForBooking(booking)
}

export default { issueFiscalReceiptForBooking, retryPendingFiscalReceipt, FISCAL_STATUS }
