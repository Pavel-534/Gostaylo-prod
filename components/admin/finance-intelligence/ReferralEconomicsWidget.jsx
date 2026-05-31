'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   referralPeriod?: Record<string, unknown>,
 *   periodInsights?: { profitSummary?: Record<string, unknown> },
 *   loading?: boolean,
 * }} props
 */
export function ReferralEconomicsWidget({ referralPeriod, periodInsights, loading }) {
  const profit = periodInsights?.profitSummary || {};
  const referral = referralPeriod || {};
  const roi = Number(referral.roiIndex);
  const netMargin = Number(referral.netMarginThb);
  const referralOutflow = Number(profit.referralOutflowThb ?? referral.earnedBonusesThb);

  if (loading) {
    return <Card className="h-44 animate-pulse bg-slate-100 border-0" />;
  }

  return (
    <Card className="border-violet-200/80 shadow-sm bg-gradient-to-br from-violet-50/60 via-white to-indigo-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              Referral Economics
            </CardTitle>
            <CardDescription>Влияние рефералки на чистую прибыль платформы</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                Net-маржа рефералки = комиссия с реферальных броней минус бонусы и clawback. Эта сумма
                уже учтена в «чистой прибыли» наверху дашборда.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2">
            <div className="text-[10px] uppercase text-slate-500">Net-маржа рефералки</div>
            <AdminTableAmount
              value={netMargin}
              showPlus
              className={cn('font-bold', netMargin >= 0 ? 'text-emerald-700' : 'text-rose-700')}
            />
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2">
            <div className="text-[10px] uppercase text-slate-500">ROI программы</div>
            <span className={cn('text-lg font-bold tabular-nums', roiToneClass(roi))}>
              {Number.isFinite(roi) ? roi.toFixed(2) : '—'}
            </span>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 col-span-2">
            <div className="text-[10px] uppercase text-slate-500">Вычитается из чистой прибыли</div>
            <AdminTableAmount value={referralOutflow} showPlus={false} className="font-semibold" />
            <p className="text-[10px] text-slate-500 mt-0.5">Бонусы promo tank за период (до clawback)</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full border-violet-200 hover:bg-violet-50">
          <Link href="/admin/marketing/roi">
            Подробный ROI-пульт
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default ReferralEconomicsWidget;
