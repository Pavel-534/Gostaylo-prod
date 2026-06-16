import { supabaseAdmin } from '@/lib/supabase'
import { getSiteDisplayName } from '@/lib/site-url'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules'
import { resolveListingCategoryContext } from '@/lib/services/booking.service'
import { getUIText } from '@/lib/translations'
import { resolveGuestNotifyLocale } from '@/lib/i18n/resolve-notify-locale'

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function toUpper(value) {
  return String(value || '').trim().toUpperCase()
}

/**
 * Mirror paid status into chat invoice message metadata (Realtime UPDATE → InvoiceBubble).
 */
async function syncInvoiceMessageStatusPaid({ invoiceId, nowIso, txId, gatewayRef }) {
  if (!invoiceId || !supabaseAdmin) return { synced: false, reason: 'missing_config' }

  const { data: rows, error } = await supabaseAdmin
    .from('messages')
    .select('id, metadata, conversation_id')
    .eq('type', 'invoice')
    .filter('metadata->>invoice_id', 'eq', String(invoiceId))
    .limit(5)

  if (error) {
    console.warn('[INVOICE EXTENSION] invoice message lookup failed:', error.message)
    return { synced: false, reason: 'lookup_failed' }
  }

  const targets = Array.isArray(rows) ? rows : []
  if (!targets.length) {
    const { data: fallbackRows, error: fbErr } = await supabaseAdmin
      .from('messages')
      .select('id, metadata, conversation_id')
      .eq('type', 'invoice')
      .contains('metadata', { invoice: { id: String(invoiceId) } })
      .limit(5)
    if (fbErr) {
      console.warn('[INVOICE EXTENSION] invoice message fallback lookup failed:', fbErr.message)
      return { synced: false, reason: 'lookup_failed' }
    }
    if (Array.isArray(fallbackRows)) targets.push(...fallbackRows)
  }

  if (!targets.length) {
    const { data: invRow } = await supabaseAdmin
      .from('invoices')
      .select('id, booking_id')
      .eq('id', String(invoiceId))
      .maybeSingle()
    if (invRow?.booking_id) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('booking_id', String(invRow.booking_id))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (conv?.id) {
        const { data: convMsgs, error: convErr } = await supabaseAdmin
          .from('messages')
          .select('id, metadata, conversation_id')
          .eq('conversation_id', conv.id)
          .eq('type', 'invoice')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!convErr && Array.isArray(convMsgs)) {
          for (const row of convMsgs) {
            const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
            const inv = meta.invoice && typeof meta.invoice === 'object' ? meta.invoice : {}
            const linkedId = String(meta.invoice_id || inv.id || '')
            if (linkedId === String(invoiceId)) targets.push(row)
          }
        }
      }
    }
  }

  if (!targets.length) {
    return { synced: false, reason: 'message_not_found' }
  }

  let synced = 0
  for (const row of targets) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const inv = meta.invoice && typeof meta.invoice === 'object' ? meta.invoice : {}
    const newMeta = {
      ...meta,
      invoice: {
        ...inv,
        status: 'PAID',
        paid_at: nowIso,
        paid_tx_id: txId || inv.paid_tx_id || null,
        paid_gateway_ref: gatewayRef || inv.paid_gateway_ref || null,
      },
    }
    const { error: patchErr } = await supabaseAdmin
      .from('messages')
      .update({ metadata: newMeta })
      .eq('id', row.id)
    if (patchErr) {
      console.warn('[INVOICE EXTENSION] message metadata patch failed:', patchErr.message)
      continue
    }
    synced += 1
    if (row.conversation_id) {
      await supabaseAdmin
        .from('conversations')
        .update({ updated_at: nowIso, last_message_at: nowIso })
        .eq('id', row.conversation_id)
    }
  }

  return { synced: synced > 0, count: synced }
}

/**
 * Early-release invoice soft-hold blocks (calendar_blocks.source = invoice_hold).
 * @returns {Promise<{ released: number, error?: string }>}
 */
export async function expireInvoiceHoldBlocks({ invoiceId, listingId, nowIso }) {
  if (!invoiceId || !supabaseAdmin) return { released: 0 }
  let q = supabaseAdmin
    .from('calendar_blocks')
    .update({ expires_at: nowIso })
    .eq('source', 'invoice_hold')
    .ilike('reason', `Invoice ${invoiceId}%`)
  if (listingId) q = q.eq('listing_id', listingId)
  const { data, error } = await q.select('id')
  if (error) {
    console.warn('[INVOICE EXTENSION] invoice_hold expire failed:', error.message)
    return { released: 0, error: error.message }
  }
  return { released: (data || []).length }
}

async function postExtensionSystemMessage({
  bookingId,
  invoiceId,
  newCheckOutIso,
  previousCheckOutIso,
  nowIso,
}) {
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('renter_id, metadata')
    .eq('id', bookingId)
    .maybeSingle()

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

  const lang = await resolveGuestNotifyLocale(booking, null)
  const locale =
    lang === 'zh' ? 'zh-CN' : lang === 'th' ? 'th-TH' : lang === 'en' ? 'en-US' : 'ru-RU'
  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return String(iso)
    return d.toLocaleString(locale, {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  const msg = getUIText('chatSystem_extensionConfirmed', lang).replace('{date}', fmt(newCheckOutIso))
  const row = {
    id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    conversation_id: conv.id,
    sender_id: conv.partner_id,
    sender_role: 'PARTNER',
    sender_name: getSiteDisplayName(),
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
  if (invoiceStatus === 'PAID') {
    const messageSync = await syncInvoiceMessageStatusPaid({
      invoiceId,
      nowIso,
      txId,
      gatewayRef,
    })
    return {
      success: true,
      skipped: true,
      reason: 'already_paid',
      invoiceId: String(invoiceId),
      messageSync,
    }
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
        .select('id, partner_id, check_in, check_out, status, metadata, listing:listings(category_id, metadata)')
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
            const { slug: categorySlug, wizardProfile } = await resolveListingCategoryContext(
              booking.listing?.category_id,
            )
            nextEscrowThawAt = computeEscrowThawAt({
              checkInRaw: booking.check_in,
              categorySlug,
              wizardProfile,
              escrowAtIso: bookingMeta.escrow_started || nowIso,
              listingMetadata: booking.listing?.metadata,
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

  await syncInvoiceMessageStatusPaid({
    invoiceId,
    nowIso,
    txId,
    gatewayRef,
  })

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

