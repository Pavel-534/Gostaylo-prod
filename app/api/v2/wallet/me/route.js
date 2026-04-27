import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import WalletService from '@/lib/services/finance/wallet.service';

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
  return NextResponse.json({
    success: true,
    data: {
      ...wallet.data,
      policy,
    },
  });
}

