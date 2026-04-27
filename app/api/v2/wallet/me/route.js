import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import WalletService from '@/lib/services/finance/wallet.service';
import { supabaseAdmin } from '@/lib/supabase';
import EscrowService from '@/lib/services/escrow.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const [wallet, policy] = await Promise.all([
    WalletService.getWalletSummary(session.userId),
    WalletService.getWalletPolicy(session.userId),
  ]);
  if (!wallet.success) {
    return NextResponse.json(
      { success: false, error: wallet.error || 'WALLET_READ_FAILED' },
      { status: wallet.status || 500 },
    );
  }

  /** Stage 72.6 — escrow-хостинг (не путать с маркетинговым wallet); только для PARTNER */
  let partnerEscrow = null;
  if (supabaseAdmin) {
    const { data: roleRow } = await supabaseAdmin.from('profiles').select('role').eq('id', session.userId).maybeSingle();
    const roleUpper = String(roleRow?.role || '').toUpperCase();
    if (roleUpper === 'PARTNER') {
      const esc = await EscrowService.getPartnerBalance(session.userId);
      if (esc.success && esc.balance) {
        const b = esc.balance;
        partnerEscrow = {
          frozenBalanceThb: Math.round(Number(b.frozenBalanceThb ?? b.escrowBalance ?? 0) * 100) / 100,
          availableBalanceThb: Math.round(Number(b.availableBalanceThb ?? b.availableBalance ?? 0) * 100) / 100,
        };
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      ...wallet.data,
      policy,
      partnerEscrow,
    },
  });
}

