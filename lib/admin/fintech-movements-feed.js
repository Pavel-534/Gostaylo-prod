/**
 * Stage 101.3 — unified treasury movement feed (SSOT for admin journal UI).
 */

export const MOVEMENT_KINDS = {
  CONVERSION: 'CONVERSION',
  PAYOUT_BATCH: 'PAYOUT_BATCH',
  LEDGER: 'LEDGER',
  FISCAL: 'FISCAL',
}

const LEDGER_EVENT_LABELS = {
  TREASURY_CONVERSION_RECORDED: 'Конвертация (журнал)',
  BOOKING_PAYMENT_CAPTURED: 'Оплата гостя',
  PARTNER_PAYOUT_OBLIGATION_SETTLED: 'Выплата партнёру',
  BOOKING_REFUND_PARTIAL: 'Частичный возврат',
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function toIsoDayStart(day) {
  return `${day}T00:00:00.000Z`
}

function toIsoDayEnd(day) {
  return `${day}T23:59:59.999Z`
}

/**
 * @param {object} row
 * @returns {import('./fintech-movements-feed.js').MovementRow}
 */
export function mapConversionMovement(row) {
  const fee = Number(row.conversion_fee_thb) || 0
  const loss = Number(row.conversion_loss_thb) || 0
  return {
    id: row.id,
    kind: MOVEMENT_KINDS.CONVERSION,
    createdAt: row.created_at,
    title: `${row.conversion_from_currency} → ${row.conversion_to_currency}`,
    subtitle: String(row.metadata?.operation_type || 'CONVERSION'),
    amountThb: round2(fee + loss),
    currency: row.conversion_from_currency,
    partnerId: null,
    partnerName: null,
    reference: row.journal_id || row.external_tx_reference || null,
    meta: {
      rateUsed: row.conversion_rate_used,
      amountFrom: row.metadata?.amount_from,
      amountTo: row.metadata?.amount_to,
    },
  }
}

export function mapBatchMovement(batch) {
  const statusRu = {
    DRAFT: 'Черновик пула',
    LOCKED: 'Пул зафиксирован',
    EXPORTED: 'Пул выгружен',
    SETTLED: 'Пул оплачен',
    FAILED: 'Ошибка пула',
    CANCELLED: 'Пул отменён',
  }
  return {
    id: batch.id,
    kind: MOVEMENT_KINDS.PAYOUT_BATCH,
    createdAt: batch.settled_at || batch.exported_at || batch.locked_at || batch.created_at,
    title: `Пул выплат · ${batch.rail || '—'}`,
    subtitle: statusRu[batch.status] || batch.status,
    amountThb: round2(batch.totals_thb),
    currency: 'THB',
    partnerId: null,
    partnerName: null,
    reference: batch.id,
    meta: { itemCount: batch.item_count, status: batch.status },
  }
}

export function mapLedgerMovement(journal, amountThb = null) {
  const label = LEDGER_EVENT_LABELS[journal.event_type] || journal.event_type
  return {
    id: journal.id,
    kind: MOVEMENT_KINDS.LEDGER,
    createdAt: journal.created_at,
    title: label,
    subtitle: journal.booking_id ? `Бронь ${String(journal.booking_id).slice(0, 8)}…` : 'Системная проводка',
    amountThb: amountThb != null ? round2(amountThb) : null,
    currency: 'THB',
    partnerId: journal.metadata?.partner_id || null,
    partnerName: null,
    reference: journal.id,
    meta: { eventType: journal.event_type, bookingId: journal.booking_id },
  }
}

export function mapFiscalMovement(booking) {
  return {
    id: `fiscal-${booking.id}`,
    kind: MOVEMENT_KINDS.FISCAL,
    createdAt: booking.updated_at || booking.created_at,
    title: 'Чек 54-ФЗ · ожидание',
    subtitle: booking.status,
    amountThb: null,
    currency: 'RUB',
    partnerId: booking.partner_id || null,
    partnerName: null,
    reference: booking.id,
    meta: { lastError: booking.metadata?.fiscal?.last_error || null },
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ from: string, to: string, kind?: string, currency?: string, partnerId?: string, limit?: number }} opts
 */
export async function loadFintechMovements(supabaseAdmin, opts) {
  const { from, to, kind, currency, partnerId } = opts
  const limit = Math.min(Math.max(Number(opts.limit) || 300, 1), 1000)
  const periodFrom = toIsoDayStart(from)
  const periodTo = toIsoDayEnd(to)

  const movements = []

  const want = (k) => !kind || kind === k

  if (want(MOVEMENT_KINDS.CONVERSION)) {
    let q = supabaseAdmin
      .from('ledger_entries')
      .select(
        'id,journal_id,amount_thb,conversion_from_currency,conversion_to_currency,conversion_rate_used,conversion_fee_thb,conversion_loss_thb,external_tx_reference,created_at,metadata',
      )
      .not('conversion_from_currency', 'is', null)
      .gte('created_at', periodFrom)
      .lte('created_at', periodTo)
      .order('created_at', { ascending: false })
      .limit(500)

    if (currency) {
      q = q.or(`conversion_from_currency.eq.${currency},conversion_to_currency.eq.${currency}`)
    }

    const { data } = await q
    for (const row of data || []) {
      movements.push(mapConversionMovement(row))
    }
  }

  if (want(MOVEMENT_KINDS.PAYOUT_BATCH)) {
    let batchIdsForPartner = null
    if (partnerId) {
      const { data: items } = await supabaseAdmin
        .from('payout_batch_items')
        .select('batch_id')
        .eq('partner_id', partnerId)
        .limit(2000)
      batchIdsForPartner = [...new Set((items || []).map((i) => i.batch_id).filter(Boolean))]
      if (!batchIdsForPartner.length) {
        // no batches for partner
      }
    }

    let q = supabaseAdmin
      .from('payout_batches')
      .select('id,status,rail,scheduled_for,totals_thb,item_count,created_at,locked_at,exported_at,settled_at')
      .gte('created_at', periodFrom)
      .lte('created_at', periodTo)
      .order('created_at', { ascending: false })
      .limit(200)

    if (batchIdsForPartner) {
      if (!batchIdsForPartner.length) {
        // skip
      } else {
        q = q.in('id', batchIdsForPartner)
      }
    }

    if (!partnerId || batchIdsForPartner?.length) {
      const { data } = await q
      for (const batch of data || []) {
        movements.push(mapBatchMovement(batch))
      }
    }
  }

  if (want(MOVEMENT_KINDS.LEDGER)) {
    let q = supabaseAdmin
      .from('ledger_journals')
      .select('id,booking_id,event_type,created_at,metadata')
      .gte('created_at', periodFrom)
      .lte('created_at', periodTo)
      .in('event_type', [
        'TREASURY_CONVERSION_RECORDED',
        'BOOKING_PAYMENT_CAPTURED',
        'PARTNER_PAYOUT_OBLIGATION_SETTLED',
        'BOOKING_REFUND_PARTIAL',
      ])
      .order('created_at', { ascending: false })
      .limit(400)

    const { data: journals } = await q
    const journalIds = (journals || []).map((j) => j.id)
    let amountsByJournal = new Map()
    if (journalIds.length) {
      const { data: entries } = await supabaseAdmin
        .from('ledger_entries')
        .select('journal_id,amount_thb,side')
        .in('journal_id', journalIds)
      for (const e of entries || []) {
        if (e.side !== 'DEBIT') continue
        const prev = amountsByJournal.get(e.journal_id) || 0
        amountsByJournal.set(e.journal_id, prev + (Number(e.amount_thb) || 0))
      }
    }

    for (const j of journals || []) {
      if (partnerId && j.metadata?.partner_id !== partnerId) {
        if (!j.booking_id) continue
      }
      movements.push(mapLedgerMovement(j, amountsByJournal.get(j.id) || null))
    }
  }

  if (want(MOVEMENT_KINDS.FISCAL)) {
    let q = supabaseAdmin
      .from('bookings')
      .select('id,status,partner_id,updated_at,created_at,metadata')
      .gte('updated_at', periodFrom)
      .lte('updated_at', periodTo)
      .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])
      .order('updated_at', { ascending: false })
      .limit(300)

    if (partnerId) q = q.eq('partner_id', partnerId)

    const { data } = await q
    for (const b of data || []) {
      if (String(b?.metadata?.fiscal?.status || '') !== 'PENDING_FISCAL') continue
      movements.push(mapFiscalMovement(b))
    }
  }

  movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return movements.slice(0, limit)
}
