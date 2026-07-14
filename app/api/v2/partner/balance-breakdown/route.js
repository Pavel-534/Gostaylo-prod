/**
 * GET /api/v2/partner/balance-breakdown
 * Frozen (PAID_ESCROW) vs thaw hold (THAWED <24h) vs available (THAWED≥24h / READY_FOR_PAYOUT).
 * Query: limit, offset (ledger pagination), ledgerEntry (resolve single entry by id).
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service';
import EscrowService from '@/lib/services/escrow.service';
import { supabaseAdmin } from '@/lib/supabase';
import { LedgerService } from '@/lib/services/ledger.service';

const LEDGER_TX_DEFAULT_LIMIT = 40;
const LEDGER_TX_MAX_LIMIT = 100;

function clampLedgerLimit(raw) {
  const n = parseInt(String(raw ?? LEDGER_TX_DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 0) return LEDGER_TX_DEFAULT_LIMIT;
  return Math.min(n, LEDGER_TX_MAX_LIMIT);
}

function clampLedgerOffset(raw) {
  const n = parseInt(String(raw ?? 0), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function mapLedgerEntryRow(e, jmap) {
  const j = jmap[e.journal_id];
  return {
    entryId: e.id,
    journalId: e.journal_id,
    side: e.side,
    amountThb: parseFloat(e.amount_thb) || 0,
    description: e.description || null,
    createdAt: e.created_at,
    eventType: j?.event_type || null,
    bookingId: j?.booking_id || null,
    journalCreatedAt: j?.created_at || null,
  };
}

async function attachJournalsToEntries(entries) {
  if (!entries?.length) return [];
  const journalIds = [...new Set(entries.map((e) => e.journal_id).filter(Boolean))];
  const { data: journals } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type, booking_id, created_at, metadata')
    .in('id', journalIds);

  const jmap = Object.fromEntries((journals || []).map((j) => [j.id, j]));
  return entries.map((e) => mapLedgerEntryRow(e, jmap));
}

async function fetchPartnerLedgerTransactions(partnerId, { limit = LEDGER_TX_DEFAULT_LIMIT, offset = 0 } = {}) {
  if (!supabaseAdmin || limit === 0) {
    return { rows: [], hasMore: false };
  }

  const accountId = LedgerService.partnerAccountId(partnerId);
  const { data: entries, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, journal_id, side, amount_thb, description, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !entries?.length) {
    if (error) console.warn('[BALANCE-BREAKDOWN] ledger_entries', error.message);
    return { rows: [], hasMore: false };
  }

  const rows = await attachJournalsToEntries(entries);
  return { rows, hasMore: entries.length === limit };
}

async function fetchPartnerLedgerEntryById(partnerId, entryId) {
  if (!supabaseAdmin || !entryId) return null;
  const accountId = LedgerService.partnerAccountId(partnerId);
  const { data: entry, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, journal_id, side, amount_thb, description, created_at')
    .eq('account_id', accountId)
    .eq('id', String(entryId))
    .maybeSingle();

  if (error || !entry) {
    if (error) console.warn('[BALANCE-BREAKDOWN] ledger_entry', error.message);
    return null;
  }

  const [row] = await attachJournalsToEntries([entry]);
  return row || null;
}

export async function GET(request) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const partner = await verifyPartnerAccess(userId);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = clampLedgerLimit(searchParams.get('limit'));
    const offset = clampLedgerOffset(searchParams.get('offset'));
    const ledgerEntryId = searchParams.get('ledgerEntry');

    const [bal, byCat, ledgerResult, resolvedLedgerEntry] = await Promise.all([
      EscrowService.getPartnerBalance(userId),
      EscrowService.getPartnerBalanceByCategory(userId),
      fetchPartnerLedgerTransactions(userId, { limit, offset }),
      ledgerEntryId ? fetchPartnerLedgerEntryById(userId, ledgerEntryId) : Promise.resolve(null),
    ]);

    if (!bal.success) {
      return NextResponse.json({ success: false, error: bal.error || 'balance' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: userId,
        frozenBalanceThb: bal.balance.frozenBalanceThb ?? bal.balance.escrowBalance,
        thawHoldBalanceThb: bal.balance.thawHoldBalanceThb ?? 0,
        disputeHoldBalanceThb: bal.balance.disputeHoldBalanceThb ?? 0,
        availableBalanceThb: bal.balance.availableBalanceThb ?? bal.balance.availableBalance,
        withdrawalHoldHours: bal.balance.withdrawalHoldHours ?? 24,
        totalCommissionThb: bal.balance.totalCommission,
        totalEarningsThb: bal.balance.totalEarnings,
        pendingPayoutsThb: bal.balance.pendingPayouts,
        byCategory: byCat.success ? byCat.byCategory || {} : {},
        recentLedgerTransactions: ledgerResult.rows,
        ledgerPagination: {
          limit,
          offset,
          hasMore: ledgerResult.hasMore,
        },
        resolvedLedgerEntry,
      },
    });
  } catch (error) {
    console.error('[PARTNER BALANCE-BREAKDOWN]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
