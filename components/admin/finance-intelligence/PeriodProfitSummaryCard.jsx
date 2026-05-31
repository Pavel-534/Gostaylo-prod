'use client';

import { TrendingDown, TrendingUp, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { cn } from '@/lib/utils';

/**
 * @param {{ insights?: { headline?: string, subline?: string, profitSummary?: Record<string, unknown> }, loading?: boolean }} props
 */
export function PeriodProfitSummaryCard({ insights, loading }) {
  const profit = insights?.profitSummary || {};
  const vs = profit.vsPrevious || {};
  const delta = vs.profitDeltaPct;
  const improved = delta != null && delta > 0;
  const flat = delta != null && Math.abs(delta) < 0.5;
  const netAfterAll = profit.netProfitAfterAllThb ?? profit.netProfitThb;

  if (loading) {
    return <Card className="h-40 animate-pulse bg-slate-100 border-0" />;
  }

  return (
    <Card className="border-emerald-200/80 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/90 via-white to-indigo-50/40">
      <CardHeader className="pb-2">
        <CardDescription className="text-emerald-900/70 text-xs font-medium uppercase tracking-wide flex items-center gap-1">
          Чистая прибыль платформы (после всех отчислений)
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-emerald-800/50 hover:text-emerald-900">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-xs">
                Маржа минус RU/KG/FX из снимка цены, рефералы, страховой резерв и расход FX в казне за 30 дней.
                Это ваша «реальная» прибыль за период, не оборот.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardDescription>
        <CardTitle className="text-3xl sm:text-4xl font-bold text-emerald-950 tabular-nums flex flex-wrap items-baseline gap-2">
          <AdminTableAmount value={netAfterAll} showPlus={false} className="text-3xl sm:text-4xl" />
          {delta != null && !insights?.isEmpty ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-sm font-semibold',
                flat ? 'text-slate-500' : improved ? 'text-emerald-700' : 'text-rose-700',
              )}
            >
              {!flat && (improved ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />)}
              {delta > 0 ? '+' : ''}
              {Number(delta).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%
            </span>
          ) : null}
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">{insights?.headline}</p>
        {insights?.subline ? <p className="text-xs text-slate-500 mt-0.5">{insights.subline}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">Оборот</div>
            <AdminTableAmount value={profit.gmvThb} showPlus={false} className="font-semibold" />
            <div className="text-[10px] text-slate-400">{profit.bookingsCount || 0} броней</div>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">Маржа</div>
            <AdminTableAmount value={profit.platformMarginThb} showPlus={false} className="font-semibold" />
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">RU + KG + FX</div>
            <AdminTableAmount value={profit.jurisdictionOutflowThb} showPlus={false} className="font-semibold" />
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">Рефералы</div>
            <AdminTableAmount value={profit.referralOutflowThb} showPlus={false} className="font-semibold" />
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">FX казна</div>
            <AdminTableAmount value={profit.treasuryFxCostThb} showPlus={false} className="font-semibold" />
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[10px] uppercase text-slate-500">Партнёрам</div>
            <AdminTableAmount value={profit.partnerPayoutThb} showPlus={false} className="font-semibold" />
          </div>
        </div>
        {insights?.isEmpty && vs.prevBookingsCount > 0 ? (
          <p className="mt-3 text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            Прошлый период для сравнения: {vs.prevBookingsCount} броней · оборот{' '}
            ฿{(vs.prevGmvThb || 0).toLocaleString('ru-RU')} · чистая прибыль{' '}
            ฿{(vs.prevNetProfitAfterAllThb ?? vs.prevMarginThb ?? 0).toLocaleString('ru-RU')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default PeriodProfitSummaryCard;
