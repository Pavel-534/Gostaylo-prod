'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Landmark,
  Megaphone,
  Octagon,
  RefreshCw,
  TrendingDown,
  TrendingUp,
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
import { OwnerDigestSettingsPanel } from '@/components/admin/marketing/OwnerDigestSettingsPanel';
import { RoiFraudModeToggle } from '@/components/admin/marketing/RoiFraudModeToggle';
import { RoiOwnerGuideCard } from '@/components/admin/marketing/RoiOwnerGuideCard';
import { campaignRoiDetailPath } from '@/lib/admin/marketing-roi-routes';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
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

function budgetRowClass(level) {
  if (level === 'critical') return 'bg-rose-50/80';
  if (level === 'warning') return 'bg-amber-50/60';
  return '';
}

export function BudgetAlertBanner({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.level === 'critical';
        const inner = (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm flex gap-3 items-start',
              isCritical
                ? 'border-rose-300 bg-rose-50 text-rose-950'
                : 'border-amber-300 bg-amber-50 text-amber-950',
            )}
            role="alert"
          >
            {isCritical ? (
              <Octagon className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            )}
            <p>{alert.message}</p>
          </div>
        );
        return alert.href ? (
          <Link key={`${alert.type}-${alert.campaignSlug || alert.message}`} href={alert.href}>
            {inner}
          </Link>
        ) : (
          <div key={`${alert.type}-${alert.campaignSlug || alert.message}`}>{inner}</div>
        );
      })}
    </div>
  );
}

export function ReferralRoiDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState('30d');
  const [chartGranularity, setChartGranularity] = useState('day');
  const [roiFraudMode, setRoiFraudMode] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      const q = fresh ? '&fresh=1' : '';
      const res = await fetch(`/api/admin/marketing/roi?period=${period}${q}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'ROI_LOAD_FAILED');
      setReport(json.data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить ROI');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const fraudAdjusted = report?.fraudAdjusted || {};
  const isFraudMode = roiFraudMode === 'fraud_adjusted';

  const overall = report?.overall || {};
  const displayRoi = isFraudMode ? fraudAdjusted.roiIndex : overall.roiIndex;
  const displaySpend = isFraudMode ? fraudAdjusted.spendThb : overall.earnedBonusesThb;
  const displayCommission = isFraudMode ? fraudAdjusted.commissionThb : overall.referredCommissionThb;
  const displayNet = isFraudMode ? fraudAdjusted.netEffectThb : overall.netMarginThb;

  const vs = overall.vsPrevious || {};
  const roiDelta = vs.roiDeltaPct;
  const roiImproved = roiDelta != null && roiDelta > 0;

  const chartData = useMemo(() => {
    const daily = isFraudMode ? report?.roiChartDailyAdjusted : report?.roiChartDaily;
    const weekly = isFraudMode ? report?.roiChartWeeklyAdjusted : report?.roiChartWeekly;
    if (chartGranularity === 'week') return weekly || [];
    return daily || [];
  }, [report, chartGranularity, isFraudMode]);

  const fraudBySlug = useMemo(() => {
    const map = new Map();
    for (const row of report?.campaignsFraudAdjusted || []) {
      map.set(row.campaignSlug, row);
    }
    return map;
  }, [report?.campaignsFraudAdjusted]);
  const cacOverall = report?.cacSummary?.overall || {};
  const cacBySource = report?.cacSummary?.bySource || [];

  const handleExport = (format) => {
    window.location.href = `/api/admin/marketing/roi/export?period=${period}&format=${format}`;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50/80">
        <div className={cn('border-b border-slate-200/80', GSL_FINTECH_HERO_GRADIENT)}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-white">
            <Link
              href="/admin/marketing"
              className="inline-flex items-center text-sm text-white/80 hover:text-white mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Маркетинг
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Megaphone className="h-8 w-8 text-white/70" />
                  Referral ROI
                </h1>
                <p className="text-white/70 text-sm mt-1 max-w-xl">
                  Окупаемость кампаний и реферальной программы: затраты promo tank vs комиссия платформы.
                  <Link href="#owner-guide" className="block mt-1 text-white/90 underline underline-offset-2 hover:text-white">
                    Как пользоваться аналитикой →
                  </Link>
                </p>
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
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport('xlsx')}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Excel
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Link href="/admin/finance/intelligence">
                    <Landmark className="h-4 w-4 mr-1" />
                    Financial Intelligence
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
          <BudgetAlertBanner alerts={report?.realtimeAlerts || report?.budgetAlerts} />

          <RoiOwnerGuideCard />

          {report?.businessSummary?.bullets?.length ? (
            <Card className="border-sky-200/80 shadow-sm bg-gradient-to-br from-sky-50/90 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-sky-950">Что это значит для бизнеса</CardTitle>
                <CardDescription className="text-sky-900/70">
                  Краткие выводы за выбранный период (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
                  {report.businessSummary.bullets.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <RoiFraudModeToggle
              mode={roiFraudMode}
              onChange={setRoiFraudMode}
              suspiciousCount={fraudAdjusted.suspiciousBookingsCount || 0}
            />
            {isFraudMode && fraudAdjusted.ownerNote ? (
              <p className="text-xs text-slate-600 max-w-xl">{fraudAdjusted.ownerNote}</p>
            ) : null}
          </div>

          <Card className="border-emerald-200/80 shadow-md overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-br from-emerald-50/80 to-white">
              <CardDescription className="text-xs uppercase tracking-wide text-emerald-900/70 flex items-center gap-1">
                {isFraudMode ? 'Referral ROI (без подозрительных броней)' : 'Общий Referral ROI за период'}
                <KpiHint text="ROI = комиссия платформы с реферальных броней ÷ расход promo tank (earned бонусы). >1 — программа окупается." />
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums flex flex-wrap items-baseline gap-2">
                <span className={cn(roiToneClass(displayRoi))}>
                  {Number.isFinite(Number(displayRoi)) ? Number(displayRoi).toFixed(2) : '—'}
                </span>
                {roiDelta != null ? (
                  <span
                    className={cn(
                      'text-sm font-semibold inline-flex items-center gap-0.5',
                      roiImproved ? 'text-emerald-700' : 'text-rose-700',
                    )}
                  >
                    {roiImproved ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {roiDelta > 0 ? '+' : ''}
                    {Number(roiDelta).toFixed(1)}%
                  </span>
                ) : null}
              </CardTitle>
              <p className="text-sm text-slate-600">
                {isFraudMode ? fraudAdjusted.ownerNote : report?.profitImpact?.ownerNote}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Расход (promo)',
                    value: displaySpend,
                    hint: 'Σ earned бонусов за период',
                  },
                  {
                    label: 'Комиссия',
                    value: displayCommission,
                    hint: 'Комиссия с броней реферальной воронки',
                  },
                  {
                    label: 'Net-маржа',
                    value: displayNet,
                    hint: 'Комиссия − бонусы − clawback',
                    signed: true,
                  },
                  {
                    label: 'Promo tank',
                    value: overall.promoTankBalanceThb,
                    hint: 'Текущий остаток резерва (live)',
                  },
                ].map(({ label, value, hint, signed }) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                      {label}
                      <KpiHint text={hint} />
                    </div>
                    <AdminTableAmount value={value} showPlus={signed} className="font-semibold" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="cac" className="border-indigo-200/80 shadow-sm scroll-mt-24">
            <CardHeader className="pb-2 bg-gradient-to-br from-indigo-50/80 to-white">
              <CardDescription className="text-xs uppercase tracking-wide text-indigo-900/70 flex items-center gap-1">
                Стоимость привлечения (CAC)
                <KpiHint text="CAC = расход promo tank ÷ число первых броней от реферера за период. Сравнивайте с ROI: при ROI ≥ 1 комиссия покрывает расход." />
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums flex flex-wrap items-baseline gap-3">
                <span>
                  {cacOverall.cacThb != null
                    ? `฿${Number(cacOverall.cacThb).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                    : '—'}
                </span>
                <span className="text-sm font-normal text-slate-500">
                  · {cacOverall.guestsAcquired ?? 0} гостей · ROI{' '}
                  <span className={cn('font-semibold', roiToneClass(cacOverall.roiIndex))}>
                    {cacOverall.roiIndex != null ? Number(cacOverall.roiIndex).toFixed(2) : '—'}
                  </span>
                </span>
              </CardTitle>
              <p className="text-sm text-slate-600">{cacOverall.ownerNote}</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {cacBySource.length ? (
                  cacBySource.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="text-[10px] uppercase text-slate-500">{row.label}</div>
                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="font-semibold tabular-nums">
                          {row.cacThb != null
                            ? `฿${Number(row.cacThb).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                            : '—'}
                        </span>
                        <span className={cn('text-xs font-bold tabular-nums', roiToneClass(row.roiIndex))}>
                          ROI {row.roiIndex != null ? Number(row.roiIndex).toFixed(2) : '—'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {row.guestsAcquired ?? 0} гостей · расход ฿
                        {(row.spendThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 col-span-full">Нет данных по источникам за период</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-slate-200/80 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Динамика ROI</CardTitle>
                    <CardDescription>
                      {chartGranularity === 'week'
                        ? 'Сводка по неделям (ISO)'
                        : 'Комиссия, расход promo и ROI по дням'}
                      <KpiHint text="Переключите на «Недели», чтобы сгладить шум и видеть тренд. ROI = комиссия ÷ расход." />
                    </CardDescription>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {[
                      { id: 'day', label: 'Дни' },
                      { id: 'week', label: 'Недели' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChartGranularity(opt.id)}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-md transition',
                          chartGranularity === opt.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-72">
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
                    {loading ? 'Загрузка…' : 'Нет данных за период — ROI появится после начислений'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Источники трафика</CardTitle>
                <CardDescription>Organic · Paid · Host activation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(report?.sourceBreakdown || []).length ? (
                  report.sourceBreakdown.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{row.label}</div>
                        <div className="text-[10px] text-slate-500">
                          {row.firstBookings} броней · расход ฿{(row.spendThb || 0).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <span className={cn('font-bold tabular-nums', roiToneClass(row.roiIndex))}>
                        {row.roiIndex != null ? row.roiIndex.toFixed(2) : '—'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Нет UTM-данных за период</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Кампании</CardTitle>
              <CardDescription>
                Клик по строке — детали кампании и список броней с переходом в P&L
                <KpiHint text="LTV ≈ комиссия / число гостей. % бюджета — lifetime spend vs лимит кампании." />
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Кампания</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">CAC</TableHead>
                    <TableHead className="text-right">Расход</TableHead>
                    <TableHead className="text-right">Комиссия</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Гости</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-right">Бюджет</TableHead>
                    <TableHead className="text-right">% бюджета</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-slate-500">
                        Загрузка…
                      </TableCell>
                    </TableRow>
                  ) : (report?.campaigns || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-slate-500">
                        Нет кампаний с активностью за период
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.campaigns.map((row) => {
                      const adj = fraudBySlug.get(row.campaignSlug);
                      const rowRoi = isFraudMode ? adj?.roiIndex : row.roiIndex;
                      const rowSpend = isFraudMode ? adj?.spendThb : row.spendThb;
                      const rowCommission = isFraudMode ? adj?.commissionThb : row.commissionThb;
                      const rowNet = isFraudMode ? adj?.netEffectThb : row.netEffectThb;
                      return (
                      <TableRow
                        key={row.campaignSlug}
                        className={cn(
                          'cursor-pointer hover:bg-indigo-50/40 transition-colors',
                          budgetRowClass(row.budgetAlertLevel),
                        )}
                        onClick={() =>
                          router.push(`${campaignRoiDetailPath(row.campaignSlug)}?period=${period}`)
                        }
                      >
                        <TableCell>
                          <span className="font-medium text-indigo-700">{row.campaignSlug}</span>
                          <div className="text-[10px] text-slate-400">
                            {row.clicksCount} кликов · {row.signupsCount} рег.
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right font-bold tabular-nums', roiToneClass(rowRoi))}>
                          {rowRoi != null ? rowRoi.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.cacThb != null
                            ? `฿${row.cacThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ฿{(rowSpend || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ฿{(rowCommission || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <AdminTableAmount value={rowNet} showPlus className="inline font-medium" />
                        </TableCell>
                        <TableCell className="text-right">{row.firstBookingsCount || row.signupsCount || 0}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.ltvThb != null
                            ? `฿${row.ltvThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-600">
                          {row.maxBudgetThb != null
                            ? `฿${row.maxBudgetThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                            : '∞'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-medium',
                            row.budgetAlertLevel === 'critical' && 'text-rose-700',
                            row.budgetAlertLevel === 'warning' && 'text-amber-700',
                          )}
                        >
                          {row.budgetUsagePct != null ? `${row.budgetUsagePct}%` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <OwnerDigestSettingsPanel />

          {report?.generatedAt ? (
            <p className="text-xs text-slate-400 text-center">
              Отчёт {new Date(report.generatedAt).toLocaleString('ru-RU')}
              {report.meta?.cacheHit ? ' · кэш' : ''} · {report.meta?.campaignsCount || 0} кампаний
            </p>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ReferralRoiDashboard;
