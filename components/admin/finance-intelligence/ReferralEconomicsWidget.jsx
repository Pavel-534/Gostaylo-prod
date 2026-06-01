'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { campaignRoiDetailPath } from '@/lib/admin/marketing-roi-routes';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   referralPeriod?: Record<string, unknown>,
 *   periodInsights?: { profitSummary?: Record<string, unknown> },
 *   roiHighlights?: Record<string, unknown> | null,
 *   loading?: boolean,
 * }} props
 */
export function ReferralEconomicsWidget({ referralPeriod, periodInsights, roiHighlights, loading }) {
  const profit = periodInsights?.profitSummary || {};
  const referral = referralPeriod || {};
  const highlights = roiHighlights || {};
  const roi = Number(referral.roiIndex);
  const netMargin = Number(referral.netMarginThb);
  const referralOutflow = Number(profit.referralOutflowThb ?? referral.earnedBonusesThb);
  const cac = highlights.overallCacThb;
  const totalSpend = highlights.totalSpendThb ?? referralOutflow;
  const top = highlights.topCampaign;
  const worst = highlights.worstCampaign;

  if (loading) {
    return <Card className="h-52 animate-pulse bg-slate-100 border-0" />;
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
                Net-маржа рефералки = комиссия с реферальных броней минус бонусы и clawback. CAC и
                кампании — из ROI-пульта за тот же период. Ниже — ссылка на подробный ROI и цепочку
                FI → кампания → P&L брони.
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
            <Link
              href="/admin/marketing/roi"
              className={cn('text-lg font-bold tabular-nums hover:underline', roiToneClass(roi))}
            >
              {Number.isFinite(roi) ? roi.toFixed(2) : '—'}
            </Link>
          </div>
          <Link
            href="/admin/marketing/roi#cac"
            className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 hover:border-violet-200 transition"
          >
            <div className="text-[10px] uppercase text-slate-500">CAC (средний)</div>
            <span className="font-semibold tabular-nums">
              {cac != null ? `฿${Number(cac).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}` : '—'}
            </span>
          </Link>
          <Link
            href="/admin/marketing/roi"
            className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 hover:border-violet-200 transition"
          >
            <div className="text-[10px] uppercase text-slate-500">Расход promo</div>
            <AdminTableAmount value={totalSpend} showPlus={false} className="font-semibold" />
          </Link>
          <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 col-span-2">
            <div className="text-[10px] uppercase text-slate-500">Вычитается из чистой прибыли</div>
            <AdminTableAmount value={referralOutflow} showPlus={false} className="font-semibold" />
            <p className="text-[10px] text-slate-500 mt-0.5">Бонусы promo tank за период (до clawback)</p>
          </div>
        </div>

        {(top || worst) && (
          <div className="space-y-1.5 text-xs">
            {top ? (
              <Link
                href={campaignRoiDetailPath(top.campaignSlug)}
                className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 hover:bg-emerald-50"
              >
                <span className="flex items-center gap-1 text-emerald-800">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Топ: {top.campaignName || top.campaignSlug}
                </span>
                <span className={cn('font-bold tabular-nums', roiToneClass(top.roiIndex))}>
                  ROI {top.roiIndex != null ? Number(top.roiIndex).toFixed(2) : '—'}
                </span>
              </Link>
            ) : null}
            {worst ? (
              <Link
                href={campaignRoiDetailPath(worst.campaignSlug)}
                className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 hover:bg-rose-50"
              >
                <span className="flex items-center gap-1 text-rose-800">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Анти-топ: {worst.campaignName || worst.campaignSlug}
                </span>
                <span className={cn('font-bold tabular-nums', roiToneClass(worst.roiIndex))}>
                  ROI {worst.roiIndex != null ? Number(worst.roiIndex).toFixed(2) : '—'}
                </span>
              </Link>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" size="sm" className="w-full border-violet-200 hover:bg-violet-50">
            <Link href="/admin/marketing/roi#owner-guide">
              Referral ROI-пульт
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <p className="text-[10px] text-center text-slate-500">
            Инструкция и drill-down: кампания → бронь → P&L
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReferralEconomicsWidget;
