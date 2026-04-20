/**
 * GET /api/v2/partner/balance-breakdown
 * Frozen (PAID_ESCROW) vs available (THAWED) in THB, totals + per listing category slug.
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service';
import EscrowService from '@/lib/services/escrow.service';
import { supabaseAdmin } from '@/lib/supabase';
import { LedgerService } from '@/lib/services/ledger.service';

const LEDGER_TX_LIMIT = 40;

async function fetchPartnerLedgerTransactions(partnerId) {
  if (!supabaseAdmin) return [];
  const accountId = LedgerService.partnerAccountId(partnerId);
  const { data: entries, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, journal_id, side, amount_thb, description, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(LEDGER_TX_LIMIT);

  if (error || !entries?.length) {
    if (error) console.warn('[BALANCE-BREAKDOWN] ledger_entries', error.message);
    return [];
  }

  const journalIds = [...new Set(entries.map((e) => e.journal_id).filter(Boolean))];
  const { data: journals } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type, booking_id, created_at, metadata')
    .in('id', journalIds);

  const jmap = Object.fromEntries((journals || []).map((j) => [j.id, j]));

  return entries.map((e) => {
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
  });
}

export async function GET() {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const partner = await verifyPartnerAccess(userId);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 });
    }

    const [bal, byCat, recentLedgerTransactions] = await Promise.all([
      EscrowService.getPartnerBalance(userId),
      EscrowService.getPartnerBalanceByCategory(userId),
      fetchPartnerLedgerTransactions(userId),
    ]);

    if (!bal.success) {
      return NextResponse.json({ success: false, error: bal.error || 'balance' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: userId,
        frozenBalanceThb: bal.balance.frozenBalanceThb ?? bal.balance.escrowBalance,
        availableBalanceThb: bal.balance.availableBalanceThb ?? bal.balance.availableBalance,
        totalCommissionThb: bal.balance.totalCommission,
        totalEarningsThb: bal.balance.totalEarnings,
        pendingPayoutsThb: bal.balance.pendingPayouts,
        byCategory: byCat.success ? byCat.byCategory || {} : {},
        recentLedgerTransactions,
      },
    });
  } catch (error) {
    console.error('[PARTNER BALANCE-BREAKDOWN]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
