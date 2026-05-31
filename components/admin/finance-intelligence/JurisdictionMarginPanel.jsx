'use client';

import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { cn } from '@/lib/utils';

/**
 * @param {{ insight?: Record<string, unknown>, loading?: boolean }} props
 */
export function JurisdictionMarginPanel({ insight, loading }) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  }

  const rows = insight?.rows || [];
  const poolTotal = Number(insight?.poolTotalThb) || 0;

  if (!rows.length && insight?.displayState === 'no_bookings') {
    return (
      <p className="text-sm text-slate-600 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        {insight?.ownerNote}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {(rows.filter((r) => !r.isTreasury && !r.isRetained) || []).slice(0, 3).map((row) => (
          <div
            key={row.id}
            className={cn(
              'rounded-xl border px-3 py-3',
              row.id === 'ru' && 'border-indigo-200 bg-indigo-50/60',
              row.id === 'kg' && 'border-violet-200 bg-violet-50/60',
              row.id === 'fx' && 'border-amber-200 bg-amber-50/60',
            )}
          >
            <div className="text-[10px] uppercase font-medium text-slate-600">{row.label}</div>
            <AdminTableAmount value={row.valueThb} showPlus={false} className="text-lg font-bold" />
            {poolTotal > 0 && row.sharePct != null ? (
              <div className="text-xs text-slate-500 mt-1">
                {row.sharePct}% пула ·{' '}
                {row.shareOfMarginPct != null ? `${row.shareOfMarginPct}% маржи` : ''}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {insight?.platformRetainedThb > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 flex justify-between items-center">
          <span className="text-sm text-emerald-900">Остаток на платформе после RU/KG/FX</span>
          <AdminTableAmount value={insight.platformRetainedThb} showPlus={false} className="font-bold" />
        </div>
      ) : null}
      {insight?.ownerNote ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          {insight.ownerNote}
          {insight.settlementV3Pct != null ? (
            <span className="block mt-1 text-slate-400">
              settlement_v3: {insight.settlementV3Pct}% броней
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export default JurisdictionMarginPanel;
