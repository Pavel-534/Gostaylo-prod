'use client';

import { Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';

/**
 * @param {{
 *   summary?: { totalObligationsThb?: number, rows?: Array<Record<string, unknown>>, ownerNote?: string },
 *   onDrill?: (id: string) => void,
 *   loading?: boolean,
 * }} props
 */
export function ObligationsSummaryPanel({ summary, onDrill, loading }) {
  if (loading) {
    return <Card className="h-56 animate-pulse bg-slate-100 border-0" />;
  }

  const rows = summary?.rows || [];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-600" />
          Долги и обязательства
        </CardTitle>
        <CardDescription>
          Партнёрам, рефералам и открытые пулы · всего{' '}
          <AdminTableAmount
            value={summary?.totalObligationsThb}
            showPlus={false}
            className="inline font-semibold"
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onDrill?.(row.id)}
            className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition"
          >
            <div>
              <div className="text-sm font-medium text-slate-800">{row.label}</div>
              {row.hint ? <div className="text-[10px] text-slate-500">{row.hint}</div> : null}
            </div>
            <div className="text-right">
              <AdminTableAmount value={row.valueThb} showPlus={false} className="font-bold" />
              {row.count != null && Number(row.count) > 0 ? (
                <div className="text-[10px] text-slate-400">{row.count} шт.</div>
              ) : null}
            </div>
          </button>
        ))}
        {summary?.ownerNote ? (
          <p className="text-xs text-slate-500 pt-1">{summary.ownerNote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ObligationsSummaryPanel;
