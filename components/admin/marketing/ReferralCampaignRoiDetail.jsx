'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  Landmark,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { MarketingSubNav } from '@/components/admin/marketing/MarketingSubNav';
import { BudgetAlertBanner } from '@/components/admin/marketing/ReferralRoiDashboard';
import { RoiFraudModeToggle } from '@/components/admin/marketing/RoiFraudModeToggle';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import {
  campaignMarketingManagePath,
  decodeCampaignSlugParam,
  encodeCampaignSlugForUrl,
} from '@/lib/admin/marketing-roi-routes';
import { cn } from '@/lib/utils';
import { GSL_FINTECH_HERO_GRADIENT } from '@/lib/theme/product-ui';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const PERIOD_OPTIONS = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'today', label: 'Сегодня' },
];

function KpiHint({ text }) {
  if (!text) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-slate-400 hover:text-slate-600">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * @param {{ campaignSlugParam: string }} props
 */
export function ReferralCampaignRoiDetail({ campaignSlugParam }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = decodeCampaignSlugParam(campaignSlugParam);
  const urlEnc = encodeCampaignSlugForUrl(slug);

  const [period, setPeriod] = useState(() => searchParams.get('period') || '30d');
  const [roiFraudMode, setRoiFraudMode] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      const q = fresh ? '&fresh=1' : '';
      const res = await fetch(
        `/api/admin/marketing/roi/${encodeURIComponent(urlEnc)}?period=${period}${q}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'CAMPAIGN_ROI_LOAD_FAILED');
      setReport(json.data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить кампанию');
    } finally {
      setLoading(false);
    }
  }, [period, urlEnc]);

  useEffect(() => {
    load();
  }, [load]);

  const campaign = report?.campaign || {};
  const summary = report?.summary || {};
  const fraudAdjusted = report?.fraudAdjusted || {};
  const ltvRetention = report?.ltvRetention || {};
  const isFraudMode = roiFraudMode === 'fraud_adjusted';

  const displaySummary = useMemo(() => {
    if (!isFraudMode) return summary;
    const guests = summary.guestsAcquired ?? 0;
    const spend = Number(fraudAdjusted.spendThb) || 0;
    const cacThb =
      guests > 0 && spend > 0 ? Math.round((spend / guests) * 100) / 100 : summary.cacThb;
    return {
      ...summary,
      roiIndex: fraudAdjusted.roiIndex,
      cacThb,
      spendThb: fraudAdjusted.spendThb,
      commissionThb: fraudAdjusted.commissionThb,
      netEffectThb: fraudAdjusted.netEffectThb,
      ownerNote: fraudAdjusted.ownerNote || summary.ownerNote,
    };
  }, [isFraudMode, summary, fraudAdjusted]);

  const chartData = useMemo(() => {
    if (isFraudMode) return report?.chartDailyAdjusted || report?.chartDaily || [];
    return report?.chartDaily || [];
  }, [report, isFraudMode]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50/80">
        <div className={cn('border-b border-slate-200/80', GSL_FINTECH_HERO_GRADIENT)}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-white">
            <Link
              href={`/admin/marketing/roi${period ? `?period=${period}` : ''}`}
              className="inline-flex items-center text-sm text-white/80 hover:text-white mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Referral ROI
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Megaphone className="h-8 w-8 text-white/70" />
                  {campaign.campaignName || slug}
                </h1>
                <p className="text-white/70 text-sm mt-1 font-mono">{slug}</p>
                <p className="text-white/60 text-xs mt-2">{displaySummary.ownerNote || summary.ownerNote}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg bg-white/10 p-0.5 border border-white/20">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPeriod(opt.id)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition',
                        period === opt.id ? 'bg-white text-slate-900 shadow' : 'text-white/80 hover:text-white',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => load(true)}
                  disabled={loading}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
                  Обновить
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Link href="/admin/finance/intelligence">
                    <Landmark className="h-4 w-4 mr-1" />
                    FI
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Link href={campaignMarketingManagePath(slug)}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Настройки
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <MarketingSubNav className="mb-6" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 space-y-6">
          <BudgetAlertBanner alerts={report?.realtimeAlerts} />

          <RoiFraudModeToggle
            mode={roiFraudMode}
            onChange={setRoiFraudMode}
            suspiciousCount={fraudAdjusted.suspiciousBookingsCount || report?.meta?.suspiciousBookingsCount || 0}
          />

          <Card className="border-violet-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide text-violet-800/70">
                {isFraudMode ? 'Метрики кампании (fraud-adjusted)' : 'Метрики кампании за период'}
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums flex items-baseline gap-2">
                <span className={cn(roiToneClass(displaySummary.roiIndex))}>
                  {displaySummary.roiIndex != null ? Number(displaySummary.roiIndex).toFixed(2) : '—'}
                </span>
                <span className="text-sm font-normal text-slate-500">ROI</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'CAC', value: displaySummary.cacThb, hint: 'Расход ÷ первые брони', fmt: 'thb' },
                  { label: 'Расход', value: displaySummary.spendThb, hint: 'Бонусы promo за период' },
                  { label: 'Комиссия', value: displaySummary.commissionThb, hint: 'Комиссия платформы' },
                  { label: 'Net effect', value: displaySummary.netEffectThb, hint: 'Комиссия − расход − clawback', signed: true },
                  { label: 'Гости', value: displaySummary.guestsAcquired, hint: 'Первые брони', fmt: 'num' },
                  {
                    label: '% бюджета',
                    value: campaign.budgetUsagePct,
                    hint: 'Lifetime spend vs лимит',
                    fmt: 'pct',
                  },
                ].map(({ label, value, hint, signed, fmt }) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      {label}
                      <KpiHint text={hint} />
                    </div>
                    {fmt === 'thb' ? (
                      <span className="font-semibold tabular-nums">
                        {value != null ? `฿${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}` : '—'}
                      </span>
                    ) : fmt === 'pct' ? (
                      <span className="font-semibold tabular-nums">
                        {value != null ? `${value}%` : '—'}
                      </span>
                    ) : fmt === 'num' ? (
                      <span className="font-semibold">{value ?? 0}</span>
                    ) : (
                      <AdminTableAmount value={value} showPlus={signed} className="font-semibold" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-teal-200/80 shadow-sm bg-gradient-to-br from-teal-50/50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                LTV и удержание гостей
                <KpiHint text="LTV ≈ сумма комиссии ÷ уникальные гости кампании за период. Retention — доля гостей с 2+ бронями." />
              </CardTitle>
              <CardDescription>{ltvRetention.ownerNote}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'LTV (≈)', value: ltvRetention.ltvThb, fmt: 'thb', hint: 'Комиссия / гостей' },
                  { label: 'Retention', value: ltvRetention.retentionPct, fmt: 'pct', hint: 'Гости с повторной бронью' },
                  { label: 'Гостей', value: ltvRetention.totalGuests, fmt: 'num', hint: 'Уникальные referee' },
                  { label: 'Повторных', value: ltvRetention.repeatGuests, fmt: 'num', hint: '2+ брони' },
                ].map(({ label, value, fmt, hint }) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      {label}
                      <KpiHint text={hint} />
                    </div>
                    {fmt === 'thb' ? (
                      <span className="font-semibold tabular-nums">
                        {value != null ? `฿${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}` : '—'}
                      </span>
                    ) : fmt === 'pct' ? (
                      <span className="font-semibold tabular-nums">
                        {value != null ? `${value}%` : '—'}
                      </span>
                    ) : (
                      <span className="font-semibold">{value ?? 0}</span>
                    )}
                  </div>
                ))}
              </div>
              {ltvRetention.repeatBookingsCount > 0 ? (
                <p className="text-xs text-slate-500 mt-3">
                  Повторных броней: {ltvRetention.repeatBookingsCount} · в среднем{' '}
                  {ltvRetention.avgBookingsPerGuest != null
                    ? `${ltvRetention.avgBookingsPerGuest} брони/гость`
                    : '—'}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Эффективность по дням</CardTitle>
              <CardDescription>Комиссия и расход promo только по этой кампании</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {chartData.length > 0 && !loading ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="thb" tick={{ fontSize: 11 }} width={48} />
                    <YAxis yAxisId="roi" orientation="right" tick={{ fontSize: 11 }} width={36} />
                    <RechartsTooltip
                      formatter={(v, name) => {
                        if (name === 'ROI') return [Number(v).toFixed(2), name];
                        return [`฿${Number(v).toLocaleString('ru-RU')}`, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="thb" dataKey="commissionThb" name="Комиссия" fill="#059669" opacity={0.7} />
                    <Bar yAxisId="thb" dataKey="spendThb" name="Расход" fill="#d97706" opacity={0.6} />
                    <Line
                      yAxisId="roi"
                      type="monotone"
                      dataKey="roiIndex"
                      name="ROI"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500 flex h-full items-center justify-center">
                  {loading ? 'Загрузка…' : 'Нет начислений за период'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Привлечённые брони</CardTitle>
                  <CardDescription>
                    Клик по строке → P&L брони в Financial Intelligence
                    <KpiHint text="Net effect = комиссия платформы − бонус по брони − clawback. Ссылка открывает детальный money-flow." />
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/finance/intelligence">
                    <Landmark className="h-4 w-4 mr-1" />
                    Financial Intelligence
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Бронь</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Расход</TableHead>
                    <TableHead className="text-right">Комиссия</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Загрузка…
                      </TableCell>
                    </TableRow>
                  ) : (report?.bookings || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Нет броней с начислениями за период
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.bookings.map((row) => (
                      <TableRow
                        key={row.bookingId}
                        className="cursor-pointer hover:bg-indigo-50/50"
                        onClick={() => router.push(row.plHref)}
                      >
                        <TableCell className="font-mono text-xs">{row.bookingId}</TableCell>
                        <TableCell className="text-xs text-slate-600">{row.status || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ฿{(row.spendThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ฿{(row.commissionThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <AdminTableAmount value={row.netEffectThb} showPlus className="inline font-medium" />
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-indigo-500" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ReferralCampaignRoiDetail;
