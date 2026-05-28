'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  HelpCircle,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Ticket,
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
import { CampaignBudgetAlertBanner } from '@/components/admin/referral/CampaignBudgetAlertBanner';
import { CampaignStatusBadge } from '@/components/admin/referral/CampaignStatusBadge';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import { cn } from '@/lib/utils';
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

const MS_DAY = 24 * 60 * 60 * 1000;
const LOW_ROI_THRESHOLD = 1;

const CHART_COLORS = {
  clicks: '#0d9488',
  registrations: '#6366f1',
  earnedThb: '#d97706',
  bookings: '#94a3b8',
};

function buildPeriodRanges() {
  const now = new Date();
  const currentTo = now.toISOString();
  const currentFromDate = new Date(now.getTime() - 30 * MS_DAY);
  const currentFrom = currentFromDate.toISOString();
  const prevToDate = new Date(currentFromDate.getTime() - MS_DAY);
  const prevFromDate = new Date(currentFromDate.getTime() - 30 * MS_DAY);
  return {
    current: { dateFrom: currentFrom, dateTo: currentTo },
    previous: { dateFrom: prevFromDate.toISOString(), dateTo: prevToDate.toISOString() },
  };
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function calcDeltaPct(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

function formatAbsDelta(current, previous, kind) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  const diff = c - p;
  if (kind === 'thb') {
    const sign = diff >= 0 ? '+' : '−';
    return `${sign}฿${Math.abs(diff).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
  }
  if (kind === 'roi') {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  }
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

function PeriodCompare({ current, previous, kind = 'count', invert = false }) {
  const deltaPct = calcDeltaPct(current, previous);
  const absLabel = formatAbsDelta(current, previous, kind);

  if (deltaPct == null && !absLabel) {
    return <span className="text-xs text-slate-400">нет сравнения с пред. 30 дн.</span>;
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
          <span className="font-normal text-slate-400">к пред. 30 дн.</span>
        </span>
      ) : null}
      {absLabel ? <span className="text-xs text-slate-500">{absLabel} за период</span> : null}
    </div>
  );
}

function KpiHint({ hint }) {
  if (!hint) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-slate-400 hover:text-slate-600"
          aria-label="Подсказка"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function KpiSkeleton() {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2 pt-4">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
      </CardHeader>
    </Card>
  );
}

function DashboardKpiCard({ label, hint, value, kind, deltaCurrent, deltaPrevious, accent, loading }) {
  if (loading) return <KpiSkeleton />;

  let valueNode = value;
  if (kind === 'thb') {
    valueNode = <AdminTableAmount value={value} showPlus={false} className="inline text-2xl font-bold" />;
  } else if (kind === 'roi') {
    valueNode = <span className={cn('text-2xl font-bold tabular-nums', roiToneClass(value))}>{value}</span>;
  } else {
    valueNode = <span className="text-2xl font-bold tabular-nums text-slate-950">{value}</span>;
  }

  return (
    <Card className={cn('border-slate-200/80 shadow-sm transition-shadow hover:shadow-md', accent)}>
      <CardHeader className="pb-3 pt-4">
        <CardDescription className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
          <KpiHint hint={hint} />
        </CardDescription>
        <CardTitle className="mt-1.5">{valueNode}</CardTitle>
        <PeriodCompare
          current={deltaCurrent}
          previous={deltaPrevious}
          kind={kind === 'roi' ? 'roi' : kind === 'thb' ? 'thb' : 'count'}
        />
      </CardHeader>
    </Card>
  );
}

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const labels = {
    clicks: 'Клики',
    registrations: 'Регистрации',
    earnedThb: 'Начисления (฿)',
    bookings: 'Брони',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-slate-800">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {labels[entry.dataKey] || entry.dataKey}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {entry.dataKey === 'earnedThb'
                ? `฿${Number(entry.value).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                : Number(entry.value).toLocaleString('ru-RU')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function fetchAttributionPeriod(range) {
  const q = new URLSearchParams({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    limit: '20',
  });
  const res = await fetch(`/api/v2/admin/referral/attribution?${q}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) throw new Error(json?.error || 'DASHBOARD_ATTR_FAILED');
  return json.data || null;
}

const QUICK_ACTIONS_PRIMARY = [
  {
    href: '/admin/marketing/attribution',
    label: 'Денежный пульт',
    description: 'ROI, маржа, воронка',
    icon: Banknote,
  },
  {
    href: '/admin/marketing/fraud-queue',
    label: 'Фрод-очередь',
    description: 'Ручной разбор кейсов',
    icon: ShieldAlert,
  },
  {
    href: '/admin/marketing/campaigns',
    label: 'Кампании',
    description: 'Бюджет и сроки',
    icon: Megaphone,
  },
];

const QUICK_ACTIONS_SECONDARY = [
  { href: '/admin/marketing/rules', label: 'Правила', icon: Sparkles },
  { href: '/admin/marketing/budget', label: 'Бюджет', icon: Wallet },
  { href: '/admin/marketing/promos', label: 'Промокоды', icon: Ticket },
];

/** Stage 124.2 — финальный обзорный дашборд для владельца. */
export default function MarketingDashboard() {
  const [loading, setLoading] = useState(true);
  const [attribution, setAttribution] = useState(null);
  const [attributionPrev, setAttributionPrev] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [rules, setRules] = useState([]);
  const [fraudOpen, setFraudOpen] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ranges = buildPeriodRanges();
      const [current, previous, campRes, rulesRes, fraudRes] = await Promise.all([
        fetchAttributionPeriod(ranges.current),
        fetchAttributionPeriod(ranges.previous).catch(() => null),
        fetch('/api/v2/admin/referral/campaigns', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/v2/admin/referral/reward-rules', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/v2/admin/referral/fraud-queue?status=open&limit=20', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      const campJson = await campRes.json().catch(() => ({}));
      const rulesJson = await rulesRes.json().catch(() => ({}));
      const fraudJson = await fraudRes.json().catch(() => ({}));
      setAttribution(current);
      setAttributionPrev(previous);
      setCampaigns(Array.isArray(campJson?.data) ? campJson.data : []);
      setRules(Array.isArray(rulesJson?.data) ? rulesJson.data : []);
      setFraudOpen(Array.isArray(fraudJson?.data) ? fraudJson.data : []);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить дашборд');
      setAttribution(null);
      setAttributionPrev(null);
      setCampaigns([]);
      setRules([]);
      setFraudOpen([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = attribution?.metrics || {};
  const prevMetrics = attributionPrev?.metrics || {};

  const chartRows = useMemo(() => {
    return (attribution?.chartDaily || []).map((row) => {
      const [, m, d] = String(row.date || '').split('-');
      return {
        ...row,
        label: `${d}.${m}`,
        earnedThb: Number(row.earnedThb) || 0,
        bookings: Number(row.bookings) || 0,
      };
    });
  }, [attribution?.chartDaily]);

  const activeCampaigns = campaigns.filter((c) => c.isActive !== false && c.status === 'active');
  const budgetAlerts = campaigns.filter(
    (c) => c.budgetAlertLevel === 'warning' || c.budgetAlertLevel === 'critical',
  );
  const criticalBudget = budgetAlerts.filter((c) => c.budgetAlertLevel === 'critical');
  const productionRules = rules.filter((r) => r.is_active && !r.is_shadow);
  const shadowRules = rules.filter((r) => r.is_shadow);

  const roi = Number(metrics.roiIndex);
  const lowRoi =
    Number.isFinite(roi) && roi > 0 && roi < LOW_ROI_THRESHOLD && Number(metrics.referralSpendThb) > 0;
  const suspiciousCount = Number(metrics.suspiciousConversionsCount) || 0;

  const alertItems = useMemo(() => {
    const items = [];
    for (const c of criticalBudget.slice(0, 2)) {
      items.push({ type: 'budget-critical', campaign: c, priority: 1 });
    }
    for (const c of budgetAlerts.filter((x) => x.budgetAlertLevel === 'warning').slice(0, 1)) {
      items.push({ type: 'budget-warning', campaign: c, priority: 2 });
    }
    if (fraudOpen.length > 0) {
      items.push({ type: 'fraud', count: fraudOpen.length, priority: 1 });
    }
    if (lowRoi) {
      items.push({ type: 'low-roi', roi, priority: 2 });
    }
    if (suspiciousCount > 0) {
      items.push({
        type: 'suspicious',
        count: suspiciousCount,
        pct: metrics.suspiciousConversionPct,
        priority: 3,
      });
    }
    return items.sort((a, b) => a.priority - b.priority);
  }, [criticalBudget, budgetAlerts, fraudOpen.length, lowRoi, roi, suspiciousCount, metrics.suspiciousConversionPct]);

  const kpiCards = [
    {
      label: 'Клики',
      hint: 'Last-touch клики по реферальным ссылкам за 30 дней.',
      value: metrics.clicks ?? 0,
      kind: 'count',
      current: metrics.clicks,
      previous: prevMetrics.clicks,
    },
    {
      label: 'Регистрации',
      hint: 'Уникальные регистрации после клика за период.',
      value: metrics.registrations ?? 0,
      kind: 'count',
      current: metrics.registrations,
      previous: prevMetrics.registrations,
    },
    {
      label: 'Начисления',
      hint: 'Earned-бонусы рефералки — расход promo tank за 30 дней.',
      value: metrics.earnedBonusesThb ?? 0,
      kind: 'thb',
      current: metrics.earnedBonusesThb,
      previous: prevMetrics.earnedBonusesThb,
    },
    {
      label: 'Net-маржа',
      hint: 'Комиссия минус расход на бонусы и clawback за период.',
      value: metrics.netMarginThb ?? 0,
      kind: 'thb',
      current: metrics.netMarginThb,
      previous: prevMetrics.netMarginThb,
      accent: Number(metrics.netMarginThb) >= 0 ? 'border-emerald-200/80 bg-emerald-50/25' : 'border-rose-200/80 bg-rose-50/25',
    },
    {
      label: 'ROI',
      hint: 'Комиссия / расход на бонусы. Ниже 1 — программа убыточна по деньгам.',
      value: metrics.roiIndex != null ? Number(metrics.roiIndex).toFixed(2) : '—',
      kind: 'roi',
      current: metrics.roiIndex,
      previous: prevMetrics.roiIndex,
    },
    {
      label: 'Promo tank',
      hint: 'Текущий остаток маркетингового бака (сейчас).',
      value: metrics.promoTankBalanceThb ?? 0,
      kind: 'thb',
      current: metrics.promoTankBalanceThb,
      previous: prevMetrics.promoTankBalanceThb,
      accent: 'border-teal-200/80 bg-teal-50/30',
    },
  ];

  const healthPills = [
    {
      label: 'ROI',
      value: Number.isFinite(roi) ? roi.toFixed(2) : '—',
      tone: lowRoi ? 'warn' : 'ok',
    },
    {
      label: 'Promo tank',
      value: metrics.promoTankBalanceThb != null ? `฿${Number(metrics.promoTankBalanceThb).toLocaleString('ru-RU')}` : '—',
      tone: 'neutral',
    },
    {
      label: 'Фрод',
      value: fraudOpen.length ? `${fraudOpen.length} открыто` : 'чисто',
      tone: fraudOpen.length ? 'danger' : 'ok',
    },
    {
      label: 'Кампании',
      value: `${activeCampaigns.length} активных`,
      tone: criticalBudget.length ? 'warn' : 'neutral',
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8 pb-4">
        <header className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-teal-50/30 to-slate-50 px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Маркетинг &amp; рефералка</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Обзор</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Сводка за 30 дней с сравнением с предыдущим месяцем. Точка входа в программу — всё важное здесь.
              </p>
            </div>
            <Button type="button" variant="brand" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Обновить
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {healthPills.map((pill) => (
              <span
                key={pill.label}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                  pill.tone === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                  pill.tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-950',
                  pill.tone === 'danger' && 'border-rose-200 bg-rose-50 text-rose-950',
                  pill.tone === 'neutral' && 'border-slate-200 bg-white text-slate-700',
                )}
              >
                <span className="text-slate-500">{pill.label}:</span>
                {pill.value}
              </span>
            ))}
          </div>
        </header>

        <section
          aria-label="Требует внимания"
          className={cn(
            'rounded-2xl border-2 p-4 shadow-sm sm:p-5',
            alertItems.length > 0
              ? 'border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-rose-50/40 ring-1 ring-amber-100'
              : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white',
          )}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              {alertItems.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
              Требует внимания
              {alertItems.length > 0 ? (
                <Badge variant="destructive" className="ml-1">
                  {alertItems.length}
                </Badge>
              ) : null}
            </h2>
            {alertItems.length > 0 ? (
              <span className="text-xs text-slate-500">Сначала критичное, затем предупреждения</span>
            ) : null}
          </div>

          {alertItems.length > 0 ? (
            <div className="space-y-3">
              {alertItems.map((item) => {
                if (item.type === 'budget-critical' || item.type === 'budget-warning') {
                  return <CampaignBudgetAlertBanner key={item.campaign.slug} campaign={item.campaign} />;
                }
                if (item.type === 'fraud') {
                  return (
                    <Card key="fraud" className="border-rose-300 bg-white/90 shadow-sm">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="flex items-center gap-3 text-sm font-medium text-rose-950">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                            <ShieldAlert className="h-5 w-5 text-rose-600" />
                          </span>
                          <div>
                            <p>Fraud Queue</p>
                            <p className="font-normal text-rose-800/90">
                              {item.count} {item.count === 1 ? 'кейс' : 'кейсов'} ждут решения
                            </p>
                          </div>
                        </div>
                        <Button asChild size="sm" variant="brand">
                          <Link href="/admin/marketing/fraud-queue">Разобрать сейчас</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                if (item.type === 'low-roi') {
                  return (
                    <Card key="roi" className="border-amber-300 bg-white/90 shadow-sm">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="text-sm text-amber-950">
                          <span className="font-semibold">Низкий ROI ({item.roi.toFixed(2)})</span>
                          <span className="text-amber-800"> — бонусы съедают комиссию</span>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/admin/marketing/attribution">Денежный пульт</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                if (item.type === 'suspicious') {
                  return (
                    <Card key="suspicious" className="border-amber-200 bg-white/90 shadow-sm">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="flex items-center gap-2 text-sm text-amber-950">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Подозрительных конверсий: {item.count} ({formatPct(item.pct)})
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/admin/marketing/attribution">Смотреть в аналитике</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-emerald-900">
              Критичных сигналов нет: бюджет кампаний, fraud-queue и ROI в норме за последние 30 дней.
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Ключевые показатели</h2>
            <span className="text-xs text-slate-500">30 дней · vs пред. 30 дн.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {kpiCards.map((kpi) => (
              <DashboardKpiCard
                key={kpi.label}
                label={kpi.label}
                hint={kpi.hint}
                value={kpi.value}
                kind={kpi.kind}
                deltaCurrent={kpi.current}
                deltaPrevious={kpi.previous}
                accent={kpi.accent}
                loading={loading}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-lg sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Быстрые действия</h2>
            <p className="mt-0.5 text-sm text-slate-400">Частые задачи владельца — один клик</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {QUICK_ACTIONS_PRIMARY.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col rounded-xl border border-white/10 bg-white/10 px-4 py-4 transition-all hover:border-brand/50 hover:bg-brand/20"
                >
                  <Icon className="h-6 w-6 text-brand-200 group-hover:text-white" />
                  <p className="mt-3 font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  <ArrowRight className="mt-3 h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {QUICK_ACTIONS_SECONDARY.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/15"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-950">Динамика за 30 дней</CardTitle>
            <CardDescription>
              Клики и регистрации — левая шкала; начисления (฿) и брони — правая. Наведите на точку для деталей.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-48 w-full max-w-md animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : chartRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Нет данных за период
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.earnedThb} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.earnedThb} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="vol" tick={{ fontSize: 11, fill: '#64748b' }} width={32} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="thb"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={40}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `฿${v}`}
                  />
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value) => {
                      const map = {
                        clicks: 'Клики',
                        registrations: 'Регистрации',
                        earnedThb: 'Начисления',
                        bookings: 'Брони',
                      };
                      return map[value] || value;
                    }}
                  />
                  <Area
                    yAxisId="thb"
                    type="monotone"
                    dataKey="earnedThb"
                    fill="url(#earnGrad)"
                    stroke={CHART_COLORS.earnedThb}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="vol"
                    type="monotone"
                    dataKey="clicks"
                    stroke={CHART_COLORS.clicks}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="vol"
                    type="monotone"
                    dataKey="registrations"
                    stroke={CHART_COLORS.registrations}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="vol"
                    type="monotone"
                    dataKey="bookings"
                    stroke={CHART_COLORS.bookings}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Активные кампании</CardTitle>
                <CardDescription>
                  {activeCampaigns.length} активных · {campaigns.length} всего
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/marketing/campaigns">Все</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!activeCampaigns.length ? (
                <p className="text-sm text-slate-500">Нет активных кампаний.</p>
              ) : (
                activeCampaigns.slice(0, 5).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/admin/marketing/campaigns/${encodeURIComponent(c.slug)}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-brand/25 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{c.name || c.slug}</p>
                      <p className="font-mono text-xs text-slate-500">{c.slug}</p>
                    </div>
                    <CampaignStatusBadge status={c.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Правила начислений</CardTitle>
                <CardDescription>
                  Production: {productionRules.length} · Shadow: {shadowRules.length}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/marketing/rules">Управлять</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {rules.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">v{r.version}</p>
                  </div>
                  <div className="flex gap-1">
                    {r.is_active ? <Badge className="bg-emerald-100 text-emerald-900">prod</Badge> : null}
                    {r.is_shadow ? <Badge variant="outline">shadow</Badge> : null}
                  </div>
                </div>
              ))}
              {!rules.length ? <p className="text-sm text-slate-500">Правила не настроены.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
