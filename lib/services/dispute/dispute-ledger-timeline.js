/**
 * Stage 141.2 — SSOT ledger timeline for admin dispute card (booking money path).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { computeBookingPaymentLedgerLegs } from '@/lib/services/ledger.service.js'

const ACC_DISPUTE_HOLD = 'la-sys-dispute-hold'

const BOOKING_MONEY_EVENT_TYPES = [
  'BOOKING_PAYMENT_CAPTURED',
  'DISPUTE_PARTNER_FUNDS_HELD',
  'DISPUTE_PARTNER_FUNDS_RELEASED',
  'DISPUTE_SPLIT_HOLD_SETTLED',
  'DISPUTE_REFUND_HOLD_SETTLED',
  'BOOKING_REFUND_PARTIAL',
  'PARTNER_PAYOUT_OBLIGATION_SETTLED',
]

const EVENT_META = {
  BOOKING_PAYMENT_CAPTURED: {
    label: 'Оплата гостя → эскроу',
    tone: 'escrow',
    direction: 'in',
  },
  DISPUTE_PARTNER_FUNDS_HELD: {
    label: 'Диспутный холд (блок выплаты партнёру)',
    tone: 'hold',
    direction: 'block',
  },
  DISPUTE_PARTNER_FUNDS_RELEASED: {
    label: 'Снятие холда → партнёру',
    tone: 'release',
    direction: 'out',
  },
  DISPUTE_SPLIT_HOLD_SETTLED: {
    label: 'Split: расчёт холда',
    tone: 'split',
    direction: 'split',
  },
  DISPUTE_REFUND_HOLD_SETTLED: {
    label: 'Возврат гостю: погашение холда',
    tone: 'refund',
    direction: 'refund',
  },
  BOOKING_REFUND_PARTIAL: {
    label: 'Возврат гостю (ledger)',
    tone: 'refund',
    direction: 'refund',
  },
  PARTNER_PAYOUT_OBLIGATION_SETTLED: {
    label: 'Выплата партнёру',
    tone: 'payout',
    direction: 'out',
  },
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function metaDisputeId(meta) {
  if (!meta || typeof meta !== 'object') return null
  return String(meta.dispute_id || meta.disputeId || '').trim() || null
}

function amountFromJournal(journal, entries = []) {
  const meta = journal.metadata && typeof journal.metadata === 'object' ? journal.metadata : {}
  const et = String(journal.event_type || '')

  if (et === 'BOOKING_PAYMENT_CAPTURED') {
    const legs = meta.legs
    if (legs?.guestTotalThb != null) return round2(legs.guestTotalThb)
  }
  if (et === 'BOOKING_REFUND_PARTIAL' && meta.refund_guest_thb != null) {
    return round2(meta.refund_guest_thb)
  }
  if (meta.amount_thb != null) return round2(meta.amount_thb)
  if (meta.hold_settled_thb != null) return round2(meta.hold_settled_thb)
  if (meta.partner_release_thb != null || meta.hold_guest_offset_thb != null) {
    return round2((Number(meta.partner_release_thb) || 0) + (Number(meta.hold_guest_offset_thb) || 0))
  }

  const holdDebits = (entries || [])
    .filter((e) => e.account_id === ACC_DISPUTE_HOLD && String(e.side).toUpperCase() === 'DEBIT')
    .reduce((s, e) => s + (Number(e.amount_thb) || 0), 0)
  if (holdDebits > 0) return round2(holdDebits)

  const maxEntry = (entries || []).reduce((m, e) => Math.max(m, Number(e.amount_thb) || 0), 0)
  return maxEntry > 0 ? round2(maxEntry) : null
}

function detailFromJournal(journal) {
  const meta = journal.metadata && typeof journal.metadata === 'object' ? journal.metadata : {}
  const et = String(journal.event_type || '')
  const parts = []

  if (et === 'DISPUTE_SPLIT_HOLD_SETTLED') {
    if (meta.guest_percent != null) parts.push(`гостю ${meta.guest_percent}%`)
    if (meta.partner_release_thb != null) parts.push(`партнёру ฿${round2(meta.partner_release_thb)}`)
    if (meta.hold_guest_offset_thb != null) parts.push(`offset ฿${round2(meta.hold_guest_offset_thb)}`)
  }
  if (et === 'DISPUTE_REFUND_HOLD_SETTLED' && meta.hold_settled_thb != null) {
    parts.push(`холд ฿${round2(meta.hold_settled_thb)}`)
  }
  if (meta.resolution_reason) parts.push(String(meta.resolution_reason).slice(0, 120))

  return parts.length ? parts.join(' · ') : null
}

/**
 * @param {{ bookingId: string, disputeId?: string, booking?: object }} args
 */
export async function loadDisputeLedgerTimeline(args) {
  const bookingId = String(args.bookingId || '').trim()
  const disputeId = String(args.disputeId || '').trim()
  if (!bookingId || !supabaseAdmin) {
    return { items: [], holdStatus: { active: false, amountThb: null }, summary: null }
  }

  const { data: journals, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type, booking_id, created_at, metadata, idempotency_key')
    .eq('booking_id', bookingId)
    .in('event_type', BOOKING_MONEY_EVENT_TYPES)
    .order('created_at', { ascending: true })

  if (jErr) {
    console.warn('[dispute-ledger-timeline] journals', jErr.message)
    return { items: [], holdStatus: { active: false, amountThb: null }, summary: null, error: jErr.message }
  }

  const journalIds = (journals || []).map((j) => j.id).filter(Boolean)
  let entriesByJournal = {}
  if (journalIds.length) {
    const { data: entries } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, journal_id, account_id, side, amount_thb, description')
      .in('journal_id', journalIds)
    for (const e of entries || []) {
      if (!entriesByJournal[e.journal_id]) entriesByJournal[e.journal_id] = []
      entriesByJournal[e.journal_id].push(e)
    }
  }

  const items = []
  for (const j of journals || []) {
    const dId = metaDisputeId(j.metadata)
    const isDisputeScoped =
      !dId ||
      !disputeId ||
      dId === disputeId ||
      String(j.idempotency_key || '').includes(disputeId)

    if (
      [
        'DISPUTE_PARTNER_FUNDS_HELD',
        'DISPUTE_PARTNER_FUNDS_RELEASED',
        'DISPUTE_SPLIT_HOLD_SETTLED',
        'DISPUTE_REFUND_HOLD_SETTLED',
      ].includes(j.event_type) &&
      disputeId &&
      dId &&
      dId !== disputeId
    ) {
      continue
    }

    const entries = entriesByJournal[j.id] || []
    const meta = EVENT_META[j.event_type] || {
      label: j.event_type,
      tone: 'neutral',
      direction: 'neutral',
    }

    items.push({
      id: j.id,
      eventType: j.event_type,
      label: meta.label,
      tone: meta.tone,
      direction: meta.direction,
      amountThb: amountFromJournal(j, entries),
      createdAt: j.created_at,
      disputeId: dId,
      detail: detailFromJournal(j),
      idempotencyKey: j.idempotency_key || null,
      disputeScoped: isDisputeScoped,
    })
  }

  const holdKey = disputeId ? `dispute_hold:${disputeId}` : null
  const holdJournal = holdKey
    ? (journals || []).find((j) => j.idempotency_key === holdKey)
    : null
  const holdAmount = holdJournal ? round2(holdJournal.metadata?.amount_thb) : null

  const settledKeys = disputeId
    ? new Set([
        `dispute_release:${disputeId}`,
        `dispute_split_hold:${disputeId}`,
        `dispute_refund_hold:${disputeId}`,
      ])
    : new Set()
  const holdSettled = (journals || []).some((j) => settledKeys.has(String(j.idempotency_key || '')))

  let summary = null
  if (args.booking) {
    try {
      const legs = computeBookingPaymentLedgerLegs(args.booking)
      summary = {
        guestTotalThb: round2(legs.guestTotalThb),
        partnerNetThb: round2(
          Number(args.booking.partner_earnings_thb) ||
            (Number(args.booking.price_thb) || 0) - (Number(args.booking.commission_thb) || 0),
        ),
        bookingStatus: String(args.booking.status || ''),
      }
    } catch {
      summary = {
        guestTotalThb: round2(args.booking.price_thb),
        partnerNetThb: round2(args.booking.partner_earnings_thb),
        bookingStatus: String(args.booking.status || ''),
      }
    }
  }

  return {
    items,
    holdStatus: {
      active: Boolean(holdJournal && !holdSettled),
      amountThb: holdAmount,
      settled: holdSettled,
    },
    summary,
  }
}
