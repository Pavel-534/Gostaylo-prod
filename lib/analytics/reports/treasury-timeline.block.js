/**
 * Stage 124.7 — Treasury timeline: FX conversions + payout batch settlements (30d).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

const MS_DAY = 24 * 60 * 60 * 1000;

function utcDateKey(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{ days?: number }} [opts]
 */
export async function buildTreasuryTimelineBlock(opts = {}) {
  const days = Math.min(90, Math.max(7, Number(opts.days) || 30));
  const fromIso = new Date(Date.now() - days * MS_DAY).toISOString();

  const [fxRes, batchRes] = await Promise.all([
    supabaseAdmin
      .from('ledger_entries')
      .select(
        'id, amount_thb, conversion_from_currency, conversion_to_currency, conversion_fee_thb, conversion_loss_thb, created_at',
      )
      .not('conversion_from_currency', 'is', null)
      .gte('created_at', fromIso)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('payout_batches')
      .select('id, status, rail, totals_thb, item_count, settled_at, created_at')
      .eq('status', 'SETTLED')
      .gte('settled_at', fromIso)
      .order('settled_at', { ascending: false })
      .limit(100),
  ]);

  if (fxRes.error) throw new Error(fxRes.error.message || 'TIMELINE_FX_FAILED');
  if (batchRes.error) throw new Error(batchRes.error.message || 'TIMELINE_BATCH_FAILED');

  /** @type {Array<{ id: string, type: 'fx' | 'batch_settle', at: string, date: string, label: string, amountThb: number, meta?: Record<string, unknown> }>} */
  const events = [];

  for (const row of fxRes.data || []) {
    const cost = round2((Number(row.conversion_fee_thb) || 0) + (Number(row.conversion_loss_thb) || 0));
    events.push({
      id: `fx-${row.id}`,
      type: 'fx',
      at: row.created_at,
      date: utcDateKey(row.created_at),
      label: `Конвертация ${row.conversion_from_currency}→${row.conversion_to_currency}`,
      amountThb: cost,
      meta: {
        from: row.conversion_from_currency,
        to: row.conversion_to_currency,
        feeThb: round2(row.conversion_fee_thb),
        lossThb: round2(row.conversion_loss_thb),
      },
    });
  }

  for (const b of batchRes.data || []) {
    events.push({
      id: `batch-${b.id}`,
      type: 'batch_settle',
      at: b.settled_at || b.created_at,
      date: utcDateKey(b.settled_at || b.created_at),
      label: `Выплата партнёрам · ${b.rail || 'batch'}`,
      amountThb: round2(b.totals_thb),
      meta: {
        batchId: b.id,
        itemCount: Number(b.item_count) || 0,
        rail: b.rail,
      },
    });
  }

  events.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const dayKeys = [];
  const cursor = new Date(fromIso);
  const end = new Date();
  while (cursor <= end) {
    dayKeys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const byDay = new Map(
    dayKeys.map((k) => [
      k,
      { date: k, label: k.slice(8, 10) + '.' + k.slice(5, 7), fxCostThb: 0, batchPayoutThb: 0, eventCount: 0 },
    ]),
  );

  for (const ev of events) {
    if (!ev.date || !byDay.has(ev.date)) continue;
    const row = byDay.get(ev.date);
    row.eventCount += 1;
    if (ev.type === 'fx') row.fxCostThb += Number(ev.amountThb) || 0;
    if (ev.type === 'batch_settle') row.batchPayoutThb += Number(ev.amountThb) || 0;
    byDay.set(ev.date, row);
  }

  const daily = [...byDay.values()].map((r) => ({
    ...r,
    fxCostThb: round2(r.fxCostThb),
    batchPayoutThb: round2(r.batchPayoutThb),
  }));

  return {
    periodDays: days,
    fromIso,
    events: events.slice(0, 40),
    daily,
    totals: {
      fxEvents: (fxRes.data || []).length,
      batchSettles: (batchRes.data || []).length,
      fxCostThb: round2(events.filter((e) => e.type === 'fx').reduce((s, e) => s + (e.amountThb || 0), 0)),
      batchPayoutThb: round2(
        events.filter((e) => e.type === 'batch_settle').reduce((s, e) => s + (e.amountThb || 0), 0),
      ),
    },
  };
}
