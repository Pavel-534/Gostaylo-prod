/**
 * Stage 153.2 — aggregated money timeline for admin support (read-only).
 */

import { supabaseAdmin } from '@/lib/supabase'

function parseTs(value) {
  const ms = Date.parse(String(value || ''))
  return Number.isFinite(ms) ? ms : 0
}

function pushItem(items, row) {
  if (!row?.createdAt) return
  items.push(row)
}

/**
 * @param {string} bookingId
 */
export async function loadBookingFinancialTimeline(bookingId) {
  const id = String(bookingId || '').trim()
  if (!id || !supabaseAdmin) {
    return { bookingId: id, timeline: [], counts: {} }
  }

  const items = []

  const { data: journals, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type, booking_id, created_at, metadata, idempotency_key')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  if (jErr) {
    console.warn('[booking-financial-timeline] ledger_journals', jErr.message)
  }

  const journalIds = (journals || []).map((j) => j.id).filter(Boolean)
  let entriesByJournal = {}
  if (journalIds.length) {
    const { data: entries, error: eErr } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, journal_id, account_id, side, amount_thb, description, created_at')
      .in('journal_id', journalIds)
      .order('created_at', { ascending: true })
    if (eErr) {
      console.warn('[booking-financial-timeline] ledger_entries', eErr.message)
    }
    for (const e of entries || []) {
      if (!entriesByJournal[e.journal_id]) entriesByJournal[e.journal_id] = []
      entriesByJournal[e.journal_id].push(e)
    }
  }

  for (const j of journals || []) {
    const meta = j.metadata && typeof j.metadata === 'object' ? j.metadata : {}
    const entries = (entriesByJournal[j.id] || []).map((e) => ({
      id: e.id,
      accountId: e.account_id,
      side: e.side,
      amountThb: Number(e.amount_thb) || 0,
      description: e.description || null,
      createdAt: e.created_at,
    }))
    pushItem(items, {
      source: 'ledger_journal',
      id: j.id,
      createdAt: j.created_at,
      eventType: j.event_type,
      label: j.event_type,
      idempotencyKey: j.idempotency_key || null,
      metadata: meta,
      entries,
    })
  }

  const { data: intents, error: piErr } = await supabaseAdmin
    .from('payment_intents')
    .select(
      'id, status, amount_thb, display_amount, display_currency, preferred_method, provider, external_ref, metadata, created_at, initiated_at, confirmed_at, updated_at',
    )
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  if (piErr) {
    console.warn('[booking-financial-timeline] payment_intents', piErr.message)
  }

  for (const pi of intents || []) {
    pushItem(items, {
      source: 'payment_intent',
      id: pi.id,
      createdAt: pi.created_at,
      eventType: `PAYMENT_INTENT_${String(pi.status || '').toUpperCase()}`,
      label: `Payment intent · ${pi.status}`,
      status: pi.status,
      amountThb: Number(pi.amount_thb) || 0,
      displayAmount: Number(pi.display_amount) || 0,
      displayCurrency: pi.display_currency || null,
      preferredMethod: pi.preferred_method || null,
      provider: pi.provider || null,
      externalRef: pi.external_ref || null,
      initiatedAt: pi.initiated_at || null,
      confirmedAt: pi.confirmed_at || null,
      metadata: pi.metadata && typeof pi.metadata === 'object' ? pi.metadata : {},
    })
  }

  const { data: disputes } = await supabaseAdmin
    .from('disputes')
    .select('id')
    .eq('booking_id', id)

  const disputeIds = (disputes || []).map((d) => d.id).filter(Boolean)
  if (disputeIds.length) {
    const { data: events, error: deErr } = await supabaseAdmin
      .from('dispute_events')
      .select(
        'id, dispute_id, event_type, from_status, to_status, actor_id, actor_role, reason, metadata, created_at',
      )
      .in('dispute_id', disputeIds)
      .order('created_at', { ascending: true })

    if (deErr) {
      console.warn('[booking-financial-timeline] dispute_events', deErr.message)
    }

    for (const e of events || []) {
      pushItem(items, {
        source: 'dispute_event',
        id: e.id,
        createdAt: e.created_at,
        eventType: e.event_type,
        label: e.event_type,
        disputeId: e.dispute_id,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        actorId: e.actor_id,
        actorRole: e.actor_role,
        reason: e.reason || null,
        metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : {},
      })
    }
  }

  const auditItems = []
  const { data: bookingAudit, error: baErr } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('id, action, actor_id, actor_role, entity_type, entity_id, reason, payload_json, created_at')
    .eq('entity_type', 'booking')
    .eq('entity_id', id)
    .order('created_at', { ascending: true })

  if (baErr) {
    console.warn('[booking-financial-timeline] admin_audit_logs booking', baErr.message)
  } else {
    auditItems.push(...(bookingAudit || []))
  }

  if (disputeIds.length) {
    const { data: disputeAudit, error: daErr } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('id, action, actor_id, actor_role, entity_type, entity_id, reason, payload_json, created_at')
      .eq('entity_type', 'dispute')
      .in('entity_id', disputeIds)
      .order('created_at', { ascending: true })
    if (daErr) {
      console.warn('[booking-financial-timeline] admin_audit_logs dispute', daErr.message)
    } else {
      auditItems.push(...(disputeAudit || []))
    }
  }

  for (const a of auditItems) {
    pushItem(items, {
      source: 'admin_audit',
      id: a.id,
      createdAt: a.created_at,
      eventType: a.action,
      label: a.action,
      actorId: a.actor_id,
      actorRole: a.actor_role,
      entityType: a.entity_type,
      entityId: a.entity_id,
      reason: a.reason || null,
      payload: a.payload_json && typeof a.payload_json === 'object' ? a.payload_json : {},
    })
  }

  items.sort((a, b) => parseTs(a.createdAt) - parseTs(b.createdAt))

  return {
    bookingId: id,
    timeline: items,
    counts: {
      ledgerJournals: (journals || []).length,
      paymentIntents: (intents || []).length,
      disputeEvents: items.filter((i) => i.source === 'dispute_event').length,
      adminAudit: items.filter((i) => i.source === 'admin_audit').length,
      total: items.length,
    },
  }
}
