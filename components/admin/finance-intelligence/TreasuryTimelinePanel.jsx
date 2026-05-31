'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * @param {{ timeline?: { daily?: Array<{ label: string, fxCostThb: number, batchPayoutThb: number }>, events?: Array<{ type: string, label: string, amountThb: number, at: string }>, totals?: Record<string, number> } }} props
 */
export function TreasuryTimelinePanel({ timeline }) {
  const daily = timeline?.daily || [];
  const events = timeline?.events || [];
  const hasChart = daily.some((d) => d.fxCostThb > 0 || d.batchPayoutThb > 0);

  if (!hasChart && events.length === 0) {
    return (
      <p className="text-xs text-slate-500 py-2 text-center border-t border-slate-100">
        За 30 дней нет конвертаций и закрытых пулов выплат
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">Движения казны (30 дней)</span>
        <span className="text-[10px] text-slate-400">
          FX: {timeline?.totals?.fxEvents || 0} · пулы: {timeline?.totals?.batchSettles || 0}
        </span>
      </div>
      {hasChart ? (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily.slice(-21)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={32} />
              <Tooltip
                formatter={(v, name) => [
                  `฿${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
                  name === 'fxCostThb' ? 'Конвертации' : 'Выплаты',
                ]}
              />
              <Bar dataKey="batchPayoutThb" name="Выплаты" fill="#059669" radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="fxCostThb" name="Конвертации" fill="#d97706" radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <ul className="max-h-32 overflow-y-auto space-y-1.5">
        {events.slice(0, 8).map((ev) => (
          <li
            key={ev.id}
            className="flex items-start justify-between gap-2 text-xs rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] h-4 px-1 mb-0.5',
                  ev.type === 'fx' ? 'border-amber-200 text-amber-800' : 'border-emerald-200 text-emerald-800',
                )}
              >
                {ev.type === 'fx' ? 'FX' : 'Выплата'}
              </Badge>
              <div className="text-slate-700 truncate">{ev.label}</div>
              <div className="text-[10px] text-slate-400">
                {ev.at ? new Date(ev.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
            <span className="font-semibold tabular-nums shrink-0 text-slate-800">
              ฿{(ev.amountThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TreasuryTimelinePanel;
