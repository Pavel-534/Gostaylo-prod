'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   onSelectPartner?: (partnerId: string, partnerName?: string) => void,
 * }} props
 */
export function PartnerLiabilitySheet({ open, onOpenChange, onSelectPartner }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/finance/intelligence/partners?excludeTest=1', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'PARTNERS_LOAD_FAILED');
      setData(json.data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить partner liability');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Долг партнёрам (эскроу)</SheetTitle>
          <SheetDescription>
            Сколько мы должны хостам в пайплайне и готовые к выплате · клик → брони партнёра
          </SheetDescription>
        </SheetHeader>

        {data?.totals ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">Partners</div>
              <div className="font-bold">{data.totals.partnersCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">Pipeline net</div>
              <div className="font-bold tabular-nums">
                ฿{(data.totals.totalPipelineNetThb || 0).toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin inline" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Партнёр</th>
                  <th className="text-right px-3 py-2">В эскроу</th>
                  <th className="text-right px-3 py-2">К выплате</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((row) => (
                  <tr
                    key={row.partnerId}
                    className="border-t border-slate-100 hover:bg-indigo-50/40 cursor-pointer"
                    onClick={() => onSelectPartner?.(row.partnerId, row.partnerName)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-xs truncate max-w-[180px]">{row.partnerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.partnerId.slice(0, 12)}…</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(row.byStatus || {}).map(([st, c]) => (
                          <Badge key={st} variant="outline" className="text-[9px] h-4 px-1">
                            {st}: {c}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <AdminTableAmount value={row.pipelineNetThb} showPlus={false} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <AdminTableAmount value={row.readyNetThb} showPlus={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Link
          href="/admin/settings/finances"
          className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:underline"
        >
          FinTech-пульт · выплаты
          <ChevronRight className="h-4 w-4" />
        </Link>
      </SheetContent>
    </Sheet>
  );
}

export default PartnerLiabilitySheet;
