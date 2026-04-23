import { supabaseAdmin } from '@/lib/supabase'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function toUpper(value) {
  return String(value || '').trim().toUpperCase()
}

async function expireInvoiceHoldBlocks({ invoiceId, listingId, nowIso }) {
  if (!invoiceId) return
  let q = supabaseAdmin
    .from('calendar_blocks')
    .update({ expires_at: nowIso })
    .eq('source', 'invoice_hold')
    .ilike('reason', `Invoice ${invoiceId}%`)
  if (listingId) q = q.eq('listing_id', listingId)
  const { error } = await q
  if (error) {
    console.warn('[INVOICE EXTENSION] invoice_hold expire failed:', error.message)
  }
}

async function postExtensionSystemMessage({
  bookingId,
  invoiceId,
  newCheckOutIso,
  previousCheckOutIso,
  nowIso,
}) {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, partner_id')
    .eq('booking_id', bookingId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!conv?.id || !conv.partner_id) return

  const { data: recent } = await supabaseAdmin
    .from('messages')
    .select('id, metadata')
    .eq('conversation_id', conv.id)
    .eq('type', 'system')
    .order('created_at', { ascending: false })
    .limit(10)

  const duplicated = Array.isArray(recent)
    ? recent.some((m) => String(m?.metadata?.extension_invoice_id || '') === String(invoiceId))
    : false
  if (duplicated) return

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return String(iso)
    return d.toLocaleString('ru-RU', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  const msg = `Продление подтверждено. Новый срок возврата: ${fmt(newCheckOutIso)}`
  const row = {
    id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    conversation_id: conv.id,
    sender_id: conv.partner_id,
    sender_role: 'PARTNER',
    sender_name: 'GoStayLo',
    message: msg,
    content: msg,
    type: 'system',
    metadata: {
      system_key: 'booking_extension_confirmed',
      extension_invoice_id: String(invoiceId),
      booking_id: String(bookingId),
      previous_check_out: previousCheckOutIso || null,
      new_check_out: newCheckOutIso || null,
    },
    is_read: false,
    created_at: nowIso,
  }
  const { error } = await supabaseAdmin.from('messages').insert(row)
  if (error) {
    console.warn('[INVOICE EXTENSION] extension chat message failed:', error.message)
    return
  }
  await supabaseAdmin
    .from('conversations')
    .update({ updated_at: nowIso, last_message_at: nowIso })
    .eq('id', conv.id)
}

export async function applyInvoicePostPaymentEffects({
  bookingId,
  invoiceId,
  txId = null,
  gatewayRef = null,
  source = 'payment_confirm',
}) {
  if (!invoiceId) {
    return { success: true, skipped: true, reason: 'no_invoice_id' }
  }

  const nowIso = new Date().toISOString()
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('id, booking_id, status, metadata')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) {
    console.warn('[INVOICE EXTENSION] invoice lookup failed:', invErr?.message || invoiceId)
    return { success: true, skipped: true, reason: 'invoice_not_found' }
  }

  if (String(invoice.booking_id || '') !== String(bookingId)) {
    console.warn('[INVOICE EXTENSION] booking mismatch', {
      bookingId,
      invoiceBookingId: invoice.booking_id,
      invoiceId,
    })
    return { success: true, skipped: true, reason: 'invoice_booking_mismatch' }
  }

  const invoiceStatus = toUpper(invoice.status)
  if (invoiceStatus === 'CANCELLED') {
    return { success: true, skipped: true, reason: 'invoice_cancelled' }
  }

  const invMeta = invoice.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {}
  const intent = String(invMeta.intent || '').trim().toLowerCase()
  const invoiceListingId = invMeta?.listing?.id || null

  await expireInvoiceHoldBlocks({ invoiceId, listingId: invoiceListingId, nowIso })

  let extensionApplied = false
  let extensionAlreadyApplied = false
  let extensionNewCheckOut = null
  let extensionPreviousCheckOut = null

  if (intent === 'extension') {
    const newOutIso = toIsoOrNull(invMeta.new_check_out)
    if (!newOutIso) {
      console.warn('[INVOICE EXTENSION] invalid new_check_out in metadata', { invoiceId })
    } else {
      const { data: booking, error: bErr } = await supabaseAdmin
        .from('bookings')
        .select('id, partner_id, check_in, check_out, status, metadata, listing:listings(category_id)')
        .eq('id', bookingId)
        .maybeSingle()

      if (bErr || !booking) {
        console.warn('[INVOICE EXTENSION] booking lookup failed:', bErr?.message || bookingId)
      } else {
        const bookingMeta =
          booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
        const appliedIds = Array.isArray(bookingMeta.appliedExtensionInvoiceIds)
          ? bookingMeta.appliedExtensionInvoiceIds.map(String)
          : []

        if (appliedIds.includes(String(invoiceId))) {
          extensionAlreadyApplied = true
        } else {
          const prevOutIso = toIsoOrNull(booking.check_out)
          const prevOutTs = prevOutIso ? new Date(prevOutIso).getTime() : NaN
          const nextOutTs = new Date(newOutIso).getTime()
          extensionPreviousCheckOut = prevOutIso
          extensionNewCheckOut = newOutIso

          const nextAppliedIds = [...appliedIds, String(invoiceId)]
          let nextEscrowThawAt = null
          if (booking.status === 'PAID_ESCROW' && booking.check_in) {
            const categorySlug = await resolveListingCategorySlug(booking.listing?.category_id)
            nextEscrowThawAt = computeEscrowThawAt({
              checkInRaw: booking.check_in,
              categorySlug,
              escrowAtIso: bookingMeta.escrow_started || nowIso,
            })
          }
          const nextBookingMeta = {
            ...bookingMeta,
            appliedExtensionInvoiceIds: nextAppliedIds,
            lastExtensionInvoiceId: String(invoiceId),
            lastExtensionAppliedAt: nowIso,
            lastExtensionPreviousCheckOut: prevOutIso || booking.check_out || null,
            lastExtensionNewCheckOut: newOutIso,
          }

          if (!Number.isFinite(prevOutTs) || nextOutTs > prevOutTs) {
            const { error: upErr } = await supabaseAdmin
              .from('bookings')
              .update({
                check_out: newOutIso,
                ...(nextEscrowThawAt ? { escrow_thaw_at: nextEscrowThawAt } : {}),
                metadata: nextBookingMeta,
              })
              .eq('id', bookingId)
            if (upErr) {
              console.warn('[INVOICE EXTENSION] booking update failed:', upErr.message)
            } else {
              extensionApplied = true
              await postExtensionSystemMessage({
                bookingId,
                invoiceId,
                newCheckOutIso: newOutIso,
                previousCheckOutIso: prevOutIso,
                nowIso,
              })
            }
          } else {
            // Already at same/greater check_out, but consume invoice idempotency token.
            const { error: metaErr } = await supabaseAdmin
              .from('bookings')
              .update({ metadata: nextBookingMeta })
              .eq('id', bookingId)
            if (metaErr) {
              console.warn('[INVOICE EXTENSION] booking metadata update failed:', metaErr.message)
            } else {
              extensionAlreadyApplied = true
            }
          }
        }
      }
    }
  }

  const nextInvoiceMeta = {
    ...invMeta,
    paid_at: nowIso,
    paid_source: source,
    paid_tx_id: txId || null,
    paid_gateway_ref: gatewayRef || null,
    extension_applied: extensionApplied,
    extension_already_applied: extensionAlreadyApplied,
    extension_previous_check_out: extensionPreviousCheckOut,
    extension_new_check_out: extensionNewCheckOut,
  }

  const { error: invUpErr } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'paid',
      metadata: nextInvoiceMeta,
      updated_at: nowIso,
    })
    .eq('id', invoiceId)
  if (invUpErr) {
    console.warn('[INVOICE EXTENSION] invoice update failed:', invUpErr.message)
  }

  return {
    success: true,
    invoiceId: String(invoiceId),
    intent: intent || null,
    extensionApplied,
    extensionAlreadyApplied,
    extensionNewCheckOut,
    extensionPreviousCheckOut,
  }
}

