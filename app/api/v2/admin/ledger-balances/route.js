/**
 * GET /api/v2/admin/ledger-balances — system ledger positions (THB) from posted entries.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import LedgerService from '@/lib/services/ledger.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

const SYSTEM_IDS = {
  guestClearing: 'la-sys-guest-clearing',
  platformFee: 'la-sys-platform-fee',
  insurance: 'la-sys-insurance',
  processingPot: 'la-sys-processing-pot',
};

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
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
