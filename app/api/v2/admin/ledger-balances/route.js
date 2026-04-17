/**
 * GET /api/v2/admin/ledger-balances — system ledger positions (THB) from posted entries.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionPayload } from '@/lib/services/session-service';
import LedgerService from '@/lib/services/ledger.service';

export const dynamic = 'force-dynamic';

const SYSTEM_IDS = {
  guestClearing: 'la-sys-guest-clearing',
  platformFee: 'la-sys-platform-fee',
  insurance: 'la-sys-insurance',
  processingPot: 'la-sys-processing-pot',
};

async function requireAdmin() {
  const session = await getSessionPayload();
  if (!session?.userId) return { error: 'Unauthorized', status: 401 };

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };

  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 };
  }
  return { userId: session.userId };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { data: partnerAccounts, error: paErr } = await supabaseAdmin
      .from('ledger_accounts')
      .select('id')
      .eq('code', 'PARTNER_EARNINGS');
    if (paErr) throw new Error(paErr.message);

    const partnerIds = (partnerAccounts || []).map((r) => r.id);
    const allIds = [...Object.values(SYSTEM_IDS), ...partnerIds];

    const balances = await LedgerService.sumNetBalancesByAccountIds(allIds);

    let partnerPayableThb = 0;
    for (const id of partnerIds) {
      partnerPayableThb += balances[id] || 0;
    }
    partnerPayableThb = Math.round(partnerPayableThb * 100) / 100;

    const insuranceNet = Math.round((balances[SYSTEM_IDS.insurance] || 0) * 100) / 100;
    const potNet = Math.round((balances[SYSTEM_IDS.processingPot] || 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        currency: 'THB',
        convention: 'balance = sum(CREDIT) - sum(DEBIT) per account',
        system: {
          guestPaymentClearingThb: balances[SYSTEM_IDS.guestClearing] || 0,
          platformFeeThb: balances[SYSTEM_IDS.platformFee] || 0,
          insuranceFundReserveThb: insuranceNet,
          processingPotRoundingThb: potNet,
        },
        /** Операционные алиасы Phase 1.7: визуализация «резервы» vs «котёл» по кодам ledger */
        ledgerReporting: {
          roundingPotLedgerThb: potNet,
          insuranceFundLedgerThb: insuranceNet,
          aliases: {
            RESERVES: { ledgerAccountCode: 'INSURANCE_FUND_RESERVE', netThb: insuranceNet },
            FEE_CLEARING: { ledgerAccountCode: 'PROCESSING_POT_ROUNDING', netThb: potNet },
          },
        },
        partnerEarningsTotalThb: partnerPayableThb,
        partnerAccountCount: partnerIds.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
