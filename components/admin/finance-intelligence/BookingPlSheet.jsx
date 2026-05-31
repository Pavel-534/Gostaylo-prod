'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { ReferralMarginWaterfall } from '@/components/admin/finances/FinTechMarginBar';
import { cn } from '@/lib/utils';

function LineRow({ label, value, bold = false }) {
  return (
    <div className={cn('flex items-center justify-between py-1.5 text-sm', bold && 'font-semibold border-t border-slate-200 mt-2 pt-2')}>
      <span className="text-slate-600">{label}</span>
      <AdminTableAmount value={value} showPlus={false} className={bold ? 'text-base' : ''} />
    </div>
  );
}

/**
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, bookingId: string | null }} props
 */
export function BookingPlSheet({ open, onOpenChange, bookingId }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/finance/intelligence/bookings/${encodeURIComponent(bookingId)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'PL_LOAD_FAILED');
      setReport(json.data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить P&L');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (open && bookingId) load();
  }, [open, bookingId, load]);

  const pl = report?.pl;
  const ledgerLegs = report?.ledger?.legs || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Booking P&L</SheetTitle>
          <SheetDescription className="font-mono text-xs break-all">
            {bookingId || '—'}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Загрузка P&L…
          </div>
        ) : null}

        {!loading && report ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-mono">{report.fact?.status}</Badge>
              {report.fact?.hasReferralAttribution ? (
                <Badge variant="outline">referral</Badge>
              ) : null}
              {report.ledger?.capturePosted ? (
                <Badge className="bg-emerald-600">ledger ✓</Badge>
              ) : (
                <Badge variant="outline">no ledger capture</Badge>
              )}
            </div>

            <Card className="border-slate-200/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Итог P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <LineRow label="Guest payable" value={report.guest?.guestPayableThb} />
                <LineRow label="Platform gross margin" value={pl?.platformGrossMarginThb} />
                <LineRow label="Referral cost (net)" value={pl?.referralCostThb} />
                <LineRow label="Net platform margin" value={pl?.netPlatformMarginThb} bold />
                <LineRow label="Partner payout" value={pl?.partnerPayoutThb} />
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Jurisdiction (v2)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div>RU: <AdminTableAmount value={report.jurisdiction?.ruFeeThb} showPlus={false} /></div>
                <div>KG: <AdminTableAmount value={report.jurisdiction?.krFeeThb} showPlus={false} /></div>
                <div>FX: <AdminTableAmount value={report.jurisdiction?.fxMarkupThb} showPlus={false} /></div>
                <div>Pool: <AdminTableAmount value={report.jurisdiction?.platformMarginPoolThb} showPlus={false} /></div>
              </CardContent>
            </Card>

            {(report.referral?.rows || []).length > 0 ? (
              <Card className="border-slate-200/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Referral lines</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReferralMarginWaterfall
                    commissionThb={pl?.platformGrossMarginThb}
                    bonusesThb={report.referral?.earnedThb}
                    clawbackThb={report.referral?.clawbackThb}
                    netMarginThb={pl?.netPlatformMarginThb}
                  />
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    {report.referral.rows.map((r) => (
                      <li key={r.id} className="flex justify-between border-b border-slate-100 py-1">
                        <span>{r.txType} · {r.status}</span>
                        <AdminTableAmount value={r.amountThb} showPlus={false} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {ledgerLegs.length > 0 ? (
              <Card className="border-slate-200/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Ledger legs ({ledgerLegs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs max-h-48 overflow-y-auto">
                    {ledgerLegs.map((leg) => (
                      <li key={leg.id} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                        <span className="truncate text-slate-600">
                          {leg.side} · {leg.accountCode || leg.accountId?.slice(0, 8)}
                        </span>
                        <AdminTableAmount value={leg.amountThb} showPlus={false} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/admin/bookings?search=${encodeURIComponent(bookingId || '')}`}>
                Открыть в админке броней
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default BookingPlSheet;
