'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  Clock,
  HelpCircle,
  Landmark,
  List,
  PiggyBank,
  RefreshCw,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { ReferralMarginWaterfall } from '@/components/admin/finances/FinTechMarginBar';
import IntelligenceBookingsSheet from '@/components/admin/finance-intelligence/IntelligenceBookingsSheet';
import PartnerLiabilitySheet from '@/components/admin/finance-intelligence/PartnerLiabilitySheet';
import ReferralEconomicsWidget from '@/components/admin/finance-intelligence/ReferralEconomicsWidget';
import CategoryRollupPanel from '@/components/admin/finance-intelligence/CategoryRollupPanel';
import IntelligenceExportMenu from '@/components/admin/finance-intelligence/IntelligenceExportMenu';
import TreasuryTimelinePanel from '@/components/admin/finance-intelligence/TreasuryTimelinePanel';
import PeriodProfitSummaryCard from '@/components/admin/finance-intelligence/PeriodProfitSummaryCard';
import JurisdictionMarginPanel from '@/components/admin/finance-intelligence/JurisdictionMarginPanel';
import ObligationsSummaryPanel from '@/components/admin/finance-intelligence/ObligationsSummaryPanel';
import BankReconciliationPanel from '@/components/admin/finance-intelligence/BankReconciliationPanel';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GSL_FINTECH_HERO_GRADIENT } from '@/lib/theme/product-ui';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
];

const CHART_COLORS = {
  gmv: '#6366f1',
  margin: '#059669',
  payout: '#94a3b8',
  earned: '#d97706',
};

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function formatAbsDelta(current, previous, kind = 'thb') {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  const diff = c - p;
  if (kind === 'ratio') {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  }
  const sign = diff >= 0 ? '+' : '−';
  return `${sign}฿${Math.abs(diff).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

function PeriodCompare({ deltaPct, absLabel, invert = false, live = false }) {
  if (live) {
    return <span className="text-xs text-slate-400">live · без сравнения</span>;
  }
  if (deltaPct == null && !absLabel) {
    return <span className="text-xs text-slate-400">нет сравнения с пред. периодом</span>;
  }

  const improved = invert ? (deltaPct ?? 0) < 0 : (deltaPct ?? 0) > 0;
  const flat = deltaPct != null && Math.abs(deltaPct) < 0.5;
  const Icon = flat ? null : improved ? TrendingUp : TrendingDown;
  const tone = flat ? 'text-slate-500' : improved ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      {deltaPct != null ? (
        <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', tone)}>
          {Icon ? <Icon className="h-3 w-3" /> : null}
          {deltaPct > 0 ? '+' : ''}
          {deltaPct.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%
        </span>
      ) : null}
      {absLabel ? <span className="text-[11px] text-slate-500">{absLabel} к пред. периоду</span> : null}
    </div>
  );
}

function ClickableCard({ className, onClick, children }) {
  if (!onClick) {
    return <Card className={className}>{children}</Card>;
  }
  return (
    <Card
      className={cn(className, 'cursor-pointer transition hover:shadow-md hover:border-indigo-200/80')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </Card>
  );
}

function KpiCard({ card, onClick }) {
  const isRatio = card.unit === 'ratio';
  const valueNode = isRatio ? (
    <span className={cn('text-2xl font-bold tabular-nums', roiToneClass(card.value))}>
      {Number.isFinite(Number(card.value)) ? Number(card.value).toFixed(2) : '—'}
    </span>
  ) : (
    <AdminTableAmount value={card.value} className="text-2xl font-bold" />
  );

  const absLabel = card.live
    ? null
    : formatAbsDelta(card.value, card.previousValue, isRatio ? 'ratio' : 'thb');

  return (
    <ClickableCard className="border-slate-200/80 shadow-sm" onClick={onClick}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {card.label}
          </CardDescription>
          {card.hint ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {card.hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <CardTitle className="text-base font-normal">{valueNode}</CardTitle>
        <PeriodCompare
          deltaPct={card.deltaPct}
          absLabel={absLabel}
          live={card.live}
        />
      </CardHeader>
    </ClickableCard>
  );
}

function AlertRow({ alert, onDrill }) {
  const tone =
    alert.severity === 'critical'
      ? 'border-rose-200 bg-rose-50/80 text-rose-900'
      : alert.severity === 'warning'
        ? 'border-amber-200 bg-amber-50/80 text-amber-950'
        : 'border-sky-200 bg-sky-50/80 text-sky-950';
  const Icon =
    alert.severity === 'critical' ? ShieldAlert : alert.severity === 'warning' ? AlertTriangle : CheckCircle2;

  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0 mt-0.5 opacity-80" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{alert.title}</div>
        <div className="text-xs opacity-80 mt-0.5">{alert.message}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-50 mt-1" />
    </>
  );

  if (alert.drill && onDrill) {
    return (
      <button
        type="button"
        onClick={() => onDrill(alert.drill)}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm text-left',
          tone,
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={alert.href || '#'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm',
        tone,
      )}
    >
      {inner}
    </Link>
  );
}

function JurisdictionSplitBar({ split, insight }) {
  const ru = Number(split?.ruFeeThb ?? insight?.ruFeeThb) || 0;
  const kr = Number(split?.krFeeThb ?? insight?.krFeeThb) || 0;
  const fx = Number(split?.fxMarkupThb ?? insight?.fxMarkupThb) || 0;
  const margin = Number(split?.platformMarginThb ?? insight?.platformMarginThb) || 0;
  const treasuryFx = Number(split?.treasuryFxCostThb ?? insight?.treasuryFxCostThb) || 0;
  const ownerNote = split?.ownerNote || insight?.ownerNote;
  const total = ru + kr + fx + margin;

  if (total <= 0 && treasuryFx <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 space-y-2">
        <p>{ownerNote || 'Разбивка RU/KG появится после броней с полным снимком цены.'}</p>
        {(split?.v2CoveragePct != null || insight?.v2CoveragePct != null) && total <= 0 ? (
          <p className="text-xs text-slate-400">
            Покрытие v2: {formatPct(split?.v2CoveragePct ?? insight?.v2CoveragePct)}
          </p>
        ) : null}
      </div>
    );
  }

  const segments = [
    { label: 'RU (агентство)', value: ru, color: 'bg-indigo-500' },
    { label: 'KG (сервис)', value: kr, color: 'bg-violet-500' },
    { label: 'FX в цене', value: fx, color: 'bg-amber-500' },
    { label: 'Маржа', value: margin, color: 'bg-emerald-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={seg.label}
              className={cn('flex items-center justify-center text-[10px] font-medium text-white px-1', seg.color)}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ฿${seg.value.toLocaleString('ru-RU')}`}
            >
              {pct > 10 ? seg.label : ''}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm shrink-0', seg.color)} />
            {seg.label} ฿{seg.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </div>
        ))}
      </div>
      {ownerNote ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          {ownerNote}
        </p>
      ) : null}
      {treasuryFx > 0 ? (
        <p className="text-xs text-amber-800">
          Расход FX в казне (30 дн.): ฿{treasuryFx.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
        </p>
      ) : null}
      {(split?.v2CoveragePct != null || insight?.v2CoveragePct != null) ? (
        <p className="text-xs text-slate-500">
          Снимок v2: {formatPct(split?.v2CoveragePct ?? insight?.v2CoveragePct)} броней
        </p>
      ) : null}
    </div>
  );
}

export function FinancialIntelligenceDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [bookingsFilters, setBookingsFilters] = useState({});
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [exportBookingIds, setExportBookingIds] = useState([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const openBookings = useCallback((filters = {}) => {
    setBookingsFilters(filters);
    setBookingsOpen(true);
  }, []);

  const openBookingPl = useCallback(
    (bookingId) => {
      router.push(`/admin/finance/intelligence/bookings/${encodeURIComponent(bookingId)}`);
    },
    [router],
  );

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      const q = fresh ? '&fresh=1' : '';
      const res = await fetch(`/api/admin/finance/intelligence?period=${period}&excludeTest=1${q}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'INTELLIGENCE_LOAD_FAILED');
      }
      setReport(json.data);
      setLastRefreshedAt(new Date());
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить Financial Intelligence');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const refreshAll = useCallback(() => {
    load(true);
    toast.success('Данные обновляются…');
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const heroCards = useMemo(() => {
    if (!report) return [];
    const rollup = report.bookingRollup?.current || {};
    const escrow = report.escrowPipeline || {};
    const liability = report.referral?.liability || {};
    return [
      {
        label: 'Оборот',
        value: `฿${(rollup.gmvThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
        sub: `${rollup.bookingsCount || 0} броней`,
        icon: Banknote,
      },
      {
        label: 'Маржа платформы',
        value: `฿${(rollup.platformMarginThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
        sub: 'сборы гостя и хоста',
        icon: BarChart3,
      },
      {
        label: 'В эскроу',
        value: String(escrow.totalInPipeline || 0),
        sub: 'ожидают выплаты партнёрам',
        icon: Scale,
      },
      {
        label: 'Реферальный долг',
        value: `฿${(liability.currentLiabilityThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
        sub: 'начислено минус выплачено',
        icon: Wallet,
      },
    ];
  }, [report]);

  const primaryKpis = useMemo(() => {
    const cards = report?.kpiCards || [];
    const order = [
      'gmvThb',
      'platformMarginThb',
      'guestPayableThb',
      'ruFeeThb',
      'krFeeThb',
      'fxMarkupThb',
      'netReferralMarginThb',
      'referralRoiIndex',
    ];
    return order.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
  }, [report]);

  const liveKpis = useMemo(() => {
    const cards = report?.kpiCards || [];
    return ['partnerLiabilityThb', 'referralLiabilityThb', 'promoTankBalanceThb']
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);
  }, [report]);

  const chartData = useMemo(() => {
    const revenue = report?.charts?.revenueDaily || [];
    const referral = report?.charts?.referralDaily || [];
    const byDate = new Map(revenue.map((r) => [r.date, { ...r }]));
    for (const row of referral) {
      const existing = byDate.get(row.date) || { date: row.date, label: row.label };
      existing.earnedThb = row.earnedThb;
      byDate.set(row.date, existing);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [report]);

  const escrowCounts = report?.escrowPipeline?.counts || {};
  const referralPeriod = report?.referral?.period || {};
  const escrowAging = report?.escrowAging?.buckets || [];
  const cashPosition = report?.cashPosition || {};

  const kpiDrillDown = {
    gmvThb: () => openBookings({}),
    platformMarginThb: () => openBookings({}),
    partnerLiabilityThb: () => setPartnersOpen(true),
    referralLiabilityThb: () => openBookings({ hasReferral: true }),
    promoTankBalanceThb: () => {},
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className={cn('border-b border-slate-200/80', GSL_FINTECH_HERO_GRADIENT)}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/admin/settings/finances"
                className="inline-flex items-center text-sm text-white/80 hover:text-white mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                FinTech-пульт
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Landmark className="h-8 w-8 text-white/70" />
                Финансовая аналитика
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Единое окно владельца: оборот, маржа, эскроу, рефералы и выплаты. Все цифры из одного источника данных.
              </p>
              {lastRefreshedAt ? (
                <p className="text-[11px] text-white/50 mt-2">
                  Обновлено {lastRefreshedAt.toLocaleTimeString('ru-RU')}
                  {report?.meta?.cacheHit ? ' · из кэша' : ' · свежие данные'}
                </p>
              ) : null}
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
              <IntelligenceExportMenu
                period={period}
                selectedBookingIds={exportBookingIds}
                triggerClassName="h-9 bg-white/10 text-white border-white/20 hover:bg-white/20"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openBookings({})}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <List className="h-4 w-4 mr-1" />
                Брони
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={refreshAll}
                disabled={loading}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
                Обновить всё
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {heroCards.map(({ label, value, sub, icon: Icon }, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (idx === 2) openBookings({ pipelineOnly: true });
                  else if (idx === 3) openBookings({ hasReferral: true });
                  else openBookings({});
                }}
                className="rounded-xl bg-white/10 backdrop-blur border border-white/10 px-4 py-3 text-left transition hover:bg-white/15 hover:border-white/25"
              >
                <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="text-xl font-bold mt-1">{loading ? '…' : value}</div>
                <div className="text-xs text-white/60">{sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {(report?.alerts || []).length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Быстрые алерты
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(report.alerts || []).slice(0, 6).map((a) => (
                <AlertRow key={a.code} alert={a} onDrill={openBookings} />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <PeriodProfitSummaryCard insights={report?.periodInsights} loading={loading} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Показатели за период</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="h-28 animate-pulse bg-slate-100 border-0" />
                ))
              : primaryKpis.map((card) => (
                  <KpiCard
                    key={card.id}
                    card={card}
                    onClick={kpiDrillDown[card.id] || (() => openBookings({}))}
                  />
                ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Доходы и расходы по дням</CardTitle>
              <CardDescription>Оборот, маржа платформы, выплаты партнёрам и реферальные бонусы</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <RechartsTooltip
                      formatter={(v, name) => [
                        `฿${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="gmvThb"
                      name="Оборот"
                      fill={CHART_COLORS.gmv}
                      stroke={CHART_COLORS.gmv}
                      fillOpacity={0.15}
                    />
                    <Line
                      type="monotone"
                      dataKey="platformMarginThb"
                      name="Маржа"
                      stroke={CHART_COLORS.margin}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="partnerPayoutThb"
                      name="Партнёру"
                      stroke={CHART_COLORS.payout}
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="earnedThb"
                      name="Реферал"
                      stroke={CHART_COLORS.earned}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center px-4 gap-2">
                  <p className="text-sm text-slate-600">
                    {report?.periodInsights?.chartHint || 'Нет дневной выручки за выбранный период'}
                  </p>
                  {report?.periodInsights?.profitSummary?.vsPrevious?.prevGmvThb > 0 ? (
                    <p className="text-xs text-indigo-700">
                      Прошлый период: оборот ฿
                      {report.periodInsights.profitSummary.vsPrevious.prevGmvThb.toLocaleString('ru-RU')}
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <ClickableCard
            className="border-slate-200/80 shadow-sm"
            onClick={() => openBookings({ pipelineOnly: true })}
          >
            <CardHeader>
              <CardTitle className="text-base">Эскроу (ожидают выплаты)</CardTitle>
              <CardDescription>
                Сейчас в пайплайне · долг партнёрам ฿
                {(report?.escrowPipeline?.partnerLiabilityThb || 0).toLocaleString('ru-RU')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT'].map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {status}
                    </Badge>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{escrowCounts[status] || 0}</span>
                </div>
              ))}
              {(report?.escrowPipeline?.stuckCount || 0) > 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {report.escrowPipeline.stuckCount} застряли &gt; 7 дней ·{' '}
                  <span className="underline">смотреть список</span>
                </p>
              ) : null}
              <Button asChild variant="outline" size="sm" className="w-full" onClick={(e) => e.stopPropagation()}>
                <Link href="/admin/settings/finances">FinTech-пульт</Link>
              </Button>
            </CardContent>
          </ClickableCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ClickableCard
            className="border-slate-200/80 shadow-sm"
            onClick={() => openBookings({ pipelineOnly: true, escrowAgingMinDays: 7 })}
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Escrow Aging
              </CardTitle>
              <CardDescription>Брони, застрявшие в эскроу · клик для списка</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {escrowAging.map((bucket) => (
                <button
                  key={bucket.id}
                  type="button"
                  className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-amber-300 hover:bg-amber-50/40 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBookings({ pipelineOnly: true, escrowAgingMinDays: bucket.minDays });
                  }}
                >
                  <span className="text-sm font-medium">{bucket.label}</span>
                  <span className="text-right">
                    <span className="block text-lg font-bold tabular-nums">{bucket.count}</span>
                    <span className="text-xs text-slate-500">
                      ฿{(bucket.partnerNetThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </ClickableCard>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-600" />
                Деньги и обязательства
              </CardTitle>
              <CardDescription>Готово к выплате · пулы · рефералы · движения казны</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase text-slate-500">К выплате</div>
                  <div className="font-bold tabular-nums">
                    ฿{(cashPosition.readyToPay?.totalReadyThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-500">{cashPosition.readyToPay?.totalReadyCount || 0} броней</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase text-slate-500">Открытые пулы</div>
                  <div className="font-bold tabular-nums">
                    ฿{(cashPosition.payoutBatches?.openPayoutThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-500">{cashPosition.payoutBatches?.openBatchCount || 0} пулов</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase text-slate-500">Реферальный долг</div>
                  <div className="font-bold tabular-nums">
                    ฿{(cashPosition.obligations?.referralLiabilityThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase text-slate-500">Резерв промо</div>
                  <div className="font-bold tabular-nums">
                    ฿{(cashPosition.obligations?.promoTankBalanceThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              {cashPosition.payoutBatches?.nearestBatch ? (
                <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                  Ближайший batch:{' '}
                  <span className="font-mono">{cashPosition.payoutBatches.nearestBatch.id}</span>
                  {' · '}
                  {cashPosition.payoutBatches.nearestBatch.status}
                  {' · '}
                  ฿{(cashPosition.payoutBatches.nearestBatch.totalsThb || 0).toLocaleString('ru-RU')}
                </p>
              ) : null}
              {cashPosition.treasuryConversions?.count > 0 ? (
                <p className="text-xs text-slate-500">
                  FX conversions (30d): {cashPosition.treasuryConversions.count} ops · cost ฿
                  {(cashPosition.treasuryConversions.netCostThb || 0).toLocaleString('ru-RU')}
                </p>
              ) : null}
              <TreasuryTimelinePanel timeline={cashPosition.treasuryTimeline} />
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/admin/settings/finances">Treasury в FinTech-пульте</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <CategoryRollupPanel
            rollup={report?.categoryRollup}
            onSelectCategory={(slug) => {
              openBookings({
                categorySlug: slug,
                filterTitle: `Вертикаль: ${slug}`,
              });
            }}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Разбивка маржи по юрисдикциям</CardTitle>
              <CardDescription>RU ~7% · KG ~8% · FX (ADR-097, из снимка цены)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <JurisdictionMarginPanel insight={report?.jurisdictionInsight} loading={loading} />
              <JurisdictionSplitBar split={report?.jurisdictionSplit} insight={report?.jurisdictionInsight} />
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Реферальная экономика (детали)</CardTitle>
              <CardDescription>За период · waterfall комиссия → бонусы → net</CardDescription>
            </CardHeader>
            <CardContent>
              <ReferralMarginWaterfall
                commissionThb={referralPeriod.referredCommissionThb}
                bonusesThb={referralPeriod.earnedBonusesThb}
                clawbackThb={referralPeriod.clawbackThb}
                netMarginThb={referralPeriod.netMarginThb}
              />
            </CardContent>
          </Card>

          <ReferralEconomicsWidget
            referralPeriod={referralPeriod}
            periodInsights={report?.periodInsights}
            loading={loading}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ObligationsSummaryPanel
            summary={report?.obligationsSummary}
            loading={loading}
            onDrill={(id) => {
              if (id === 'escrow' || id === 'ready') openBookings({ pipelineOnly: true });
              else if (id === 'referral') openBookings({ hasReferral: true });
              else if (id === 'batches') setPartnersOpen(true);
            }}
          />
          <BankReconciliationPanel hint={report?.bankReconciliationHint} loading={loading} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Сейчас на платформе</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {!loading &&
              liveKpis.map((card) => (
                <KpiCard
                  key={card.id}
                  card={card}
                  onClick={kpiDrillDown[card.id]}
                />
              ))}
          </div>
        </section>

        <IntelligenceBookingsSheet
          open={bookingsOpen}
          onOpenChange={setBookingsOpen}
          period={period}
          initialFilters={bookingsFilters}
          onSelectBooking={(id) => {
            setBookingsOpen(false);
            openBookingPl(id);
          }}
          onRowsLoaded={(ids) => setExportBookingIds(ids)}
        />
        <PartnerLiabilitySheet
          open={partnersOpen}
          onOpenChange={setPartnersOpen}
          onSelectPartner={(partnerId, partnerName) => {
            setPartnersOpen(false);
            openBookings({
              partnerId,
              partnerName,
              partnerPipelineOnly: true,
              filterTitle: `Партнёр: ${partnerName || partnerId.slice(0, 12)}`,
            });
          }}
        />

        {report?.generatedAt ? (
          <p className="text-xs text-slate-400 text-center pb-4">
            Отчёт от {new Date(report.generatedAt).toLocaleString('ru-RU')}
            {lastRefreshedAt ? ` · загружено ${lastRefreshedAt.toLocaleTimeString('ru-RU')}` : ''}
            {' · '}
            {report.meta?.bookingFactSampleSize || 0} броней в выборке
            {report.meta?.cacheHit ? ' · кэш' : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default FinancialIntelligenceDashboard;
