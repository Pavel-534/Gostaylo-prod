/**
 * Stage 125.0 — smoke: повторный moveToEscrow на PAID_ESCROW (killswitch + reconcile).
 */
import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service.js'
import {
  wasPaymentReceivedNotified,
  needsFiscalEscrowReconcile,
  isFiscalEscrowEffectSettled,
} from '@/lib/services/escrow/move-to-escrow-side-effects.js'
import { FISCAL_STATUS } from '@/lib/services/fiscal-kassa.service.js'

function readFiscalAttempts(metadata) {
  const fiscal = metadata?.fiscal
  if (!fiscal || typeof fiscal !== 'object') return 0
  return Number(fiscal.attempts) || 0
}

function readFiscalStatus(metadata) {
  return String(metadata?.fiscal?.status || '')
}

/**
 * @param {{ bookingId: string, guestTotalThb: number }} params
 */
export async function runEscrowMoveIdempotentStep({ bookingId, guestTotalThb }) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: false, error: 'bookingId required' }

  const { data: before, error: readErr } = await supabaseAdmin
    .from('bookings')
    .select('status, metadata, pricing_snapshot')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return { ok: false, error: readErr.message }
  if (String(before?.status || '').toUpperCase() !== 'PAID_ESCROW') {
    return { ok: false, error: `expected PAID_ESCROW before retry, got ${before?.status}` }
  }

  const fiscalSettled = isFiscalEscrowEffectSettled(before)
  const fiscalStatusBefore = readFiscalStatus(before?.metadata)
  const attemptsBefore = readFiscalAttempts(before?.metadata)

  if (!fiscalSettled) {
    if (fiscalStatusBefore !== FISCAL_STATUS.PENDING) {
      return {
        ok: false,
        error: `expected PENDING_FISCAL or terminal fiscal after first capture, got ${fiscalStatusBefore || '(none)'}`,
      }
    }
    if (attemptsBefore < 1) {
      return {
        ok: false,
        error: `expected fiscal attempts>=1 after first capture (PENDING_FISCAL), got ${attemptsBefore}`,
      }
    }
  }

  const second = await EscrowService.moveToEscrow(id, {
    source: 'smoke_escrow_idempotent_retry',
    captureGuestTotalThb: guestTotalThb,
  })

  if (!second?.success) {
    return { ok: false, error: second?.error || 'second moveToEscrow failed' }
  }
  if (!second.alreadyEscrowed || !second.idempotent) {
    return {
      ok: false,
      error: `expected alreadyEscrowed+idempotent, got alreadyEscrowed=${second.alreadyEscrowed} idempotent=${second.idempotent}`,
    }
  }

  const { data: afterSecond, error: afterErr } = await supabaseAdmin
    .from('bookings')
    .select('metadata, pricing_snapshot')
    .eq('id', id)
    .maybeSingle()

  if (afterErr) return { ok: false, error: afterErr.message }
  if (!wasPaymentReceivedNotified(afterSecond?.metadata)) {
    return { ok: false, error: 'metadata.escrow_side_effects.payment_received_at missing after idempotent path' }
  }

  if (!fiscalSettled) {
    const attemptsAfterSecond = readFiscalAttempts(afterSecond?.metadata)
    if (attemptsAfterSecond !== attemptsBefore) {
      return {
        ok: false,
        error: `fiscal attempts changed on idempotent retry: ${attemptsBefore} → ${attemptsAfterSecond}`,
      }
    }
    if (Array.isArray(second.reconciledEffects) && second.reconciledEffects.includes('fiscal')) {
      return {
        ok: false,
        error: 'idempotent moveToEscrow must not reconcile fiscal when PENDING_FISCAL+attempts>0',
      }
    }
    if (needsFiscalEscrowReconcile({ ...before, metadata: afterSecond?.metadata })) {
      return { ok: false, error: 'needsFiscalEscrowReconcile should be false after failed attempt' }
    }
    if (readFiscalStatus(afterSecond?.metadata) !== FISCAL_STATUS.PENDING) {
      return {
        ok: false,
        error: `expected PENDING_FISCAL after idempotent path, got ${afterSecond?.metadata?.fiscal?.status}`,
      }
    }
  }

  const meta =
    afterSecond?.metadata && typeof afterSecond.metadata === 'object' ? { ...afterSecond.metadata } : {}
  const effects = { ...(meta.escrow_side_effects || {}) }
  delete effects.payment_received_at
  await supabaseAdmin
    .from('bookings')
    .update({
      metadata: { ...meta, escrow_side_effects: effects },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  const third = await EscrowService.moveToEscrow(id, {
    source: 'smoke_escrow_reconcile_payment_received',
    captureGuestTotalThb: guestTotalThb,
  })

  if (!third?.success || !third.alreadyEscrowed) {
    return { ok: false, error: third?.error || 'reconcile moveToEscrow failed' }
  }
  if (!Array.isArray(third.reconciledEffects) || !third.reconciledEffects.includes('payment_received')) {
    return {
      ok: false,
      error: `expected reconcile payment_received, got ${JSON.stringify(third.reconciledEffects || [])}`,
    }
  }

  const { data: afterThird } = await supabaseAdmin
    .from('bookings')
    .select('metadata, pricing_snapshot')
    .eq('id', id)
    .maybeSingle()

  if (!wasPaymentReceivedNotified(afterThird?.metadata)) {
    return { ok: false, error: 'payment_received marker not restored after reconcile' }
  }

  if (!fiscalSettled) {
    const attemptsAfterThird = readFiscalAttempts(afterThird?.metadata)
    if (attemptsAfterThird !== attemptsBefore) {
      return {
        ok: false,
        error: `fiscal attempts changed after payment_received reconcile: ${attemptsBefore} → ${attemptsAfterThird}`,
      }
    }
  }

  const fiscalDetail = fiscalSettled
    ? 'fiscal settled (skipped reconcile checks)'
    : 'fiscal not re-attempted on idempotent path'
  return {
    ok: true,
    detail: `moveToEscrow idempotent + payment_received reconcile; ${fiscalDetail}`,
  }
}
