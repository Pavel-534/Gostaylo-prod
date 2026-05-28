'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  ChevronDown,
  ChevronRight,
  Download,
  HelpCircle,
  LineChart,
  RefreshCw,
  Megaphone,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { AdminStatusPill } from '@/components/admin/AdminStatusPill';
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState';
import { FinTechMarginBar } from '@/components/admin/finances/FinTechMarginBar';
import {
  REFERRAL_KPI_DEFINITIONS,
  REFERRAL_PERIOD_PRESETS,
  datesForReferralPreset,
  marginBgClass,
  marginToneClass,
  roiToneClass,
} from '@/lib/admin/referral-monetary-kpi';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ReferralFunnelPanel,
  ReferrerPersonalFunnel,
} from '@/components/admin/referral/ReferralFunnelPanel';

const FINTECH_NAVY = '#0f172a';

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function formatDateTime(value) {
  const d = new Date(value || '');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU');
}

function formatChartDay(dateKey) {
  if (!dateKey) return '';
  const [, m, d] = String(dateKey).split('-');
  return `${d}.${m}`;
}

function defaultDateFrom() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

function buildQueryParams({
  dateFrom,
  dateTo,
  status,
  ledgerStatus,
  referrerId,
  utmSource,
  campaignSlug,
  minMarginThb,
  profitabilityFilter,
  limit,
}) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
  if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59.999Z`).toISOString());
  if (status && status !== 'all') params.set('status', status);
  if (ledgerStatus && ledgerStatus !== 'all') params.set('ledgerStatus', ledgerStatus);
  const rid = String(referrerId || '').trim();
  if (rid) params.set('referrerId', rid);
  if (utmSource && utmSource !== 'all') params.set('utmSource', utmSource);
  if (campaignSlug && campaignSlug !== 'all') params.set('campaignSlug', campaignSlug);
  const mm = String(minMarginThb ?? '').trim();
  if (mm !== '') params.set('minMarginThb', mm);
  if (profitabilityFilter && profitabilityFilter !== 'all') {
    params.set('profitabilityFilter', profitabilityFilter);
  }
  params.set('limit', String(limit || 80));
  return params;
}

function SortHeader({ label, sortKey, currentKey, dir, onSort, className }) {
  const active = currentKey === sortKey;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 font-medium hover:text-brand ${className || ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand' : 'text-slate-400'}`} />
    </button>
  );
}

function KpiTooltip({ hint, formula }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-slate-400 hover:text-brand"
          aria-label="Подсказка"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left leading-snug">
        <p>{hint}</p>
        <p className="mt-1 font-mono text-[10px] opacity-90">{formula}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function KpiCard({ def, metrics, referrerTotal }) {
  const raw = metrics[def.key];
  const subRaw = def.subKey ? metrics[def.subKey] : null;

  let valueNode;
  if (def.format === 'roi') {
    valueNode = (
      <span className={roiToneClass(raw)}>
        {raw != null ? Number(raw).toFixed(2) : 'n/a'}
      </span>
    );
  } else if (def.format === 'ratio') {
    valueNode = (
      <span className="text-xl tabular-nums font-bold text-slate-900">
        {raw ?? 0}
        <span className="text-sm font-normal text-slate-500"> / {referrerTotal}</span>
      </span>
    );
  } else if (def.format === 'number') {
    valueNode = <span className="text-xl tabular-nums font-bold text-slate-900">{Number(raw || 0)}</span>;
  } else if (def.format === 'percent') {
    valueNode = <span className="text-xl tabular-nums font-bold text-slate-900">{formatPct(raw)}</span>;
  } else if (def.signed) {
    valueNode = (
      <span className={marginToneClass(raw)}>
        <AdminTableAmount value={raw ?? 0} showPlus className="inline text-lg font-bold" />
      </span>
    );
  } else {
    valueNode = (
      <AdminTableAmount value={raw ?? 0} showPlus={false} className="text-lg font-bold" />
    );
  }

  const cardAccent =
    def.key === 'promoTankBalanceThb'
      ? 'border-emerald-200/80 bg-emerald-50/20'
      : def.key === 'netMarginThb' || def.key === 'grossMarginThb'
        ? marginBgClass(raw)
        : 'border-slate-200/80 bg-white';

  return (
    <Card className={`shadow-sm ${cardAccent}`}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1 text-xs">
          <span>{def.label}</span>
          <KpiTooltip hint={def.hint} formula={def.formula} />
        </CardDescription>
        <CardTitle className="text-lg">{valueNode}</CardTitle>
        {def.subKey ? (
          <p className="text-xs text-muted-foreground">
            {def.subLabel}:{' '}
            {def.subKey === 'promoTankSpentPct' || def.subKey === 'suspiciousConversionPct' ? formatPct(subRaw) : (
              <AdminTableAmount value={subRaw} showPlus={false} className="inline text-xs" />
            )}
          </p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

export default function ReferralAttributionAdminPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [status, setStatus] = useState('all');
  const [ledgerStatus, setLedgerStatus] = useState('all');
  const [referrerId, setReferrerId] = useState('');
  const [utmSource, setUtmSource] = useState('all');
  const [campaignSlug, setCampaignSlug] = useState('all');
  const [minMarginThb, setMinMarginThb] = useState('');
  const [profitabilityFilter, setProfitabilityFilter] = useState('all');
  const [showClicksJournal, setShowClicksJournal] = useState(false);
  const [sortKey, setSortKey] = useState('netMarginThb');
  const [sortDir, setSortDir] = useState('desc');
  const [referrerDetailOpen, setReferrerDetailOpen] = useState(false);
  const [referrerDetailTab, setReferrerDetailTab] = useState('overview');
  const [referrerDetailLoading, setReferrerDetailLoading] = useState(false);
  const [referrerDetail, setReferrerDetail] = useState(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [mainTab, setMainTab] = useState('money');
  const [deepLinkAttributionId, setDeepLinkAttributionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams({
        dateFrom,
        dateTo,
        status,
        ledgerStatus,
        referrerId,
        utmSource,
        campaignSlug,
        minMarginThb,
        profitabilityFilter,
        limit: 500,
      });
      const res = await fetch(`/api/v2/admin/referral/attribution?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'REFERRAL_ATTRIBUTION_LOAD_FAILED');
      }
      setData(json.data || null);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить денежный пульт');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status, ledgerStatus, referrerId, utmSource, campaignSlug, minMarginThb, profitabilityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fromQuery = String(searchParams.get('campaignSlug') || '').trim();
    if (fromQuery) setCampaignSlug(fromQuery);
    const fromReferrerQuery = String(searchParams.get('referrerId') || '').trim();
    if (fromReferrerQuery) setReferrerId(fromReferrerQuery);
    const fromAttributionQuery = String(searchParams.get('attributionId') || '').trim();
    if (fromAttributionQuery) {
      setShowClicksJournal(true);
      setDeepLinkAttributionId(fromAttributionQuery);
    }
  }, [searchParams]);

  const metrics = data?.metrics || {};
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const referrerRows = Array.isArray(data?.referrerMonetaryRows) ? data.referrerMonetaryRows : [];
  const utmOptions = Array.isArray(data?.utmSourceOptions) ? data.utmSourceOptions : [];
  const campaignOptions = Array.isArray(data?.campaignOptions) ? data.campaignOptions : [];
  const campaignRows = Array.isArray(data?.campaignRows) ? data.campaignRows : [];

  useEffect(() => {
    if (!deepLinkAttributionId) return;
    const exists = rows.some((row) => String(row?.id || '') === deepLinkAttributionId);
    if (!exists) return;
    const row = rows.find((x) => String(x?.id || '') === deepLinkAttributionId);
    void openLedger(deepLinkAttributionId, row?.click_id || '');
    setDeepLinkAttributionId('');
  }, [deepLinkAttributionId, rows]);

  const chartRows = useMemo(() => {
    return (data?.chartDaily || []).map((row) => ({
      ...row,
      label: formatChartDay(row.date),
    }));
  }, [data?.chartDaily]);

  const sortedReferrerRows = useMemo(() => {
    const list = [...referrerRows];
    const dirMul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'ru') * dirMul;
      }
      return (Number(av) - Number(bv)) * dirMul;
    });
    return list;
  }, [referrerRows, sortKey, sortDir]);

  function applyPeriodPreset(presetId) {
    const preset = REFERRAL_PERIOD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const { dateFrom: from, dateTo: to } = datesForReferralPreset(preset);
    setDateFrom(from);
    setDateTo(to);
    setPeriodPreset(presetId);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function downloadCsv(format, label) {
    try {
      const params = buildQueryParams({
        dateFrom,
        dateTo,
        status,
        ledgerStatus,
        referrerId,
        utmSource,
        campaignSlug,
        minMarginThb,
        profitabilityFilter,
        limit: 500,
      });
      params.set('format', format);
      const res = await fetch(`/api/v2/admin/referral/attribution?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('CSV_EXPORT_FAILED');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-${format.replace('-csv', '')}_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(label);
    } catch (e) {
      toast.error(e?.message || 'Ошибка экспорта');
    }
  }

  async function openReferrerDetail(referrerRow) {
    if (!referrerRow?.referrerId) return;
    setReferrerDetailOpen(true);
    setReferrerDetailTab('overview');
    setReferrerDetailLoading(true);
    setReferrerDetail(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
      if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59.999Z`).toISOString());
      params.set('referrerId', referrerRow.referrerId);
      const res = await fetch(
        `/api/v2/admin/referral/attribution/referrer?${params.toString()}`,
        { credentials: 'include', cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'REFERRER_DETAIL_FAILED');
      setReferrerDetail(json.data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить карточку');
      setReferrerDetailOpen(false);
    } finally {
      setReferrerDetailLoading(false);
    }
  }

  async function openLedger(attributionId, clickId) {
    if (!attributionId) return;
    setLedgerOpen(true);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const res = await fetch(
        `/api/v2/admin/referral/attribution/ledger?attributionId=${encodeURIComponent(attributionId)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'LEDGER_LOAD_FAILED');
      setLedgerData({ ...json.data, clickId });
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить ledger');
      setLedgerOpen(false);
    } finally {
      setLedgerLoading(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: FINTECH_NAVY }}>
              Аналитика рефералки
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Денежный пульт, воронка 2.0, фильтры и экспорты. ROI по когортам — в разделе «Бюджет и аудит».
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadCsv('referrers-csv', 'CSV: рефереры')}>
              <Download className="mr-2 h-4 w-4" />
              Рефереры
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadCsv('cohort-csv', 'CSV: когорты')}>
              <Download className="mr-2 h-4 w-4" />
              Когорты
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/marketing/campaigns">Кампании</Link>
            </Button>
            <Button type="button" variant="brand" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="money">Деньги &amp; P&amp;L</TabsTrigger>
            <TabsTrigger value="funnel">Воронка 2.0</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel" className="mt-0 space-y-6">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка воронки…</p>
            ) : (
              <ReferralFunnelPanel funnel={data?.funnel} chartRows={chartRows} />
            )}
          </TabsContent>

          <TabsContent value="money" className="mt-0 space-y-6">
        <Card
          className={
            campaignSlug !== 'all'
              ? 'border-2 border-brand bg-gradient-to-r from-brand/10 via-brand/5 to-white shadow-md'
              : 'border-2 border-dashed border-slate-300 bg-slate-50/80 shadow-sm'
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-brand shrink-0" />
              Реферальная кампания
            </CardTitle>
            <CardDescription>
              {campaignSlug !== 'all'
                ? `Показаны только данные кампании «${campaignSlug}» — KPI, рефереры и экспорт CSV учитывают этот slug.`
                : 'Выберите кампанию, чтобы сузить денежный пульт и таблицу метрик по кампаниям.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,280px)] flex-1">
              <Label className="text-slate-800 font-medium">Кампания</Label>
              <Select value={campaignSlug} onValueChange={setCampaignSlug}>
                <SelectTrigger className="mt-1 h-11 border-slate-300 bg-white font-medium">
                  <SelectValue placeholder="Все кампании" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все кампании</SelectItem>
                  {campaignOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {campaignSlug !== 'all' ? (
              <>
                <Button asChild type="button" variant="brand" size="sm" className="h-11">
                  <Link href={`/admin/marketing/campaigns/${encodeURIComponent(campaignSlug)}`}>
                    Карточка кампании
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() => setCampaignSlug('all')}
                >
                  <X className="mr-1 h-4 w-4" />
                  Сбросить
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-brand/20 bg-gradient-to-br from-brand/5 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Период и фильтры</CardTitle>
            <CardDescription>Быстрые пресеты UTC · детальные фильтры ниже</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {REFERRAL_PERIOD_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={periodPreset === p.id ? 'brand' : 'outline'}
                  onClick={() => applyPeriodPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <div>
                <Label htmlFor="attr-from">С</Label>
                <Input
                  id="attr-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPeriodPreset('custom');
                  }}
                />
              </div>
              <div>
                <Label htmlFor="attr-to">По</Label>
                <Input
                  id="attr-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPeriodPreset('custom');
                  }}
                />
              </div>
              <div>
                <Label>UTM source</Label>
                <Select value={utmSource} onValueChange={setUtmSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {utmOptions.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Окупаемость</Label>
                <Select value={profitabilityFilter} onValueChange={setProfitabilityFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="profitable">Окупившиеся</SelectItem>
                    <SelectItem value="unprofitable">Убыточные</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="min-margin">Мин. net-маржа</Label>
                <Input id="min-margin" type="number" placeholder="0" value={minMarginThb} onChange={(e) => setMinMarginThb(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="attr-referrer">Referrer ID</Label>
                <Input id="attr-referrer" placeholder="user-…" value={referrerId} onChange={(e) => setReferrerId(e.target.value)} />
              </div>
              <div>
                <Label>Статус кликов</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="clicked">clicked</SelectItem>
                    <SelectItem value="converted">converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Статус ledger</Label>
                <Select value={ledgerStatus} onValueChange={setLedgerStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="earned">earned (в кошельке)</SelectItem>
                    <SelectItem value="earned_held">earned_held (в холде)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200/70 bg-cyan-50/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Метрики по кампаниям</CardTitle>
              <CardDescription>Клики, регистрации, первые/повторные брони, earned, расход бюджета и ROI.</CardDescription>
            </div>
            <Badge variant="outline">{campaignRows.length} камп.</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!campaignRows.length ? (
              <p className="text-sm text-slate-500">Нет данных по кампаниям за выбранный период.</p>
            ) : (
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Registrations</TableHead>
                    <TableHead className="text-right">First</TableHead>
                    <TableHead className="text-right">Repeat</TableHead>
                    <TableHead className="text-right">Suspicious</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignRows.map((row) => (
                    <TableRow key={row.campaignSlug}>
                      <TableCell className="font-mono text-xs">
                        {row.campaignSlug && row.campaignSlug !== '(default)' ? (
                          <Link
                            href={`/admin/marketing/campaigns/${encodeURIComponent(row.campaignSlug)}`}
                            className="text-brand hover:underline"
                          >
                            {row.campaignSlug}
                          </Link>
                        ) : (
                          row.campaignSlug
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.clicksCount || 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.signupsCount || 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.firstBookingsCount || 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.repeatBookingsCount || 0}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(row.suspiciousConversionsCount || 0) > 0 ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-900">
                            {row.suspiciousConversionsCount}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right"><AdminTableAmount value={row.earnedThb || 0} showPlus={false} /></TableCell>
                      <TableCell className="text-right"><AdminTableAmount value={row.spendThb || 0} showPlus={false} /></TableCell>
                      <TableCell className={`text-right ${roiToneClass(row.roiIndex)}`}>
                        {row.roiIndex != null ? Number(row.roiIndex).toFixed(2) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          {REFERRAL_KPI_DEFINITIONS.map((def) => (
            <KpiCard key={def.key} def={def} metrics={metrics} referrerTotal={referrerRows.length} />
          ))}
        </div>

        <Card className="border-indigo-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: '4px solid #6366f1' }}>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: FINTECH_NAVY }}>
              Водопад маржи
              <KpiTooltip
                hint="Визуализация: от комиссии платформы к net-марже после бонусов и clawback."
                formula="net = комиссия − бонусы − clawback"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FinTechMarginBar
              variant="referral"
              acceptedThb={metrics.referredCommissionThb ?? 0}
              paidOutThb={metrics.promoTankSpendThb ?? 0}
              lossesThb={metrics.clawbackThb ?? 0}
              netMarginThb={metrics.netMarginThb ?? 0}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base" style={{ color: FINTECH_NAVY }}>
                Денежные результаты по реферерам
              </CardTitle>
              <CardDescription>Клик по строке — карточка · горизонтальный скролл на узких экранах</CardDescription>
            </div>
            <Badge variant="outline">{sortedReferrerRows.length} строк</Badge>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loading ? (
              <p className="px-6 pb-6 text-sm text-slate-500">Загрузка…</p>
            ) : !sortedReferrerRows.length ? (
              <div className="px-6 pb-6">
                <FinTechEmptyState icon={Banknote} title="Нет данных" description="Измените фильтры или период." />
              </div>
            ) : (
              <div className="relative overflow-x-auto rounded-b-lg border-t sm:border-t-0">
                <p className="px-4 py-2 text-xs text-slate-400 sm:hidden">← прокрутите таблицу →</p>
                <Table className="min-w-[1280px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead><SortHeader label="Реферер" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Клики" sortKey="clicksCount" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Привлеч." sortKey="referredUsersCount" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="CR→1-я бронь" sortKey="firstBookingCrPct" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Repeat" sortKey="repeatBookingsCount" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Брони" sortKey="bookingsCount" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Комиссия" sortKey="commissionThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Бонусы" sortKey="bonusesThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="В холде" sortKey="heldBonusesThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Clawback" sortKey="clawbackThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Gross" sortKey="grossMarginThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="Net" sortKey="netMarginThb" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="ROI" sortKey="roiIndex" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="ml-auto" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReferrerRows.map((row) => (
                      <TableRow key={row.referrerId} className="cursor-pointer hover:bg-brand/5" onClick={() => void openReferrerDetail(row)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/users/${row.referrerId}`} className="font-medium text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                              {row.name}
                            </Link>
                            {row.isProfitable ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">окупился</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-rose-600">убыток</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{row.referralCode}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.clicksCount ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.referredUsersCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">
                          {formatPct(row.firstBookingCrPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.repeatBookingsCount ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.bookingsCount}</TableCell>
                        <TableCell className="text-right"><AdminTableAmount value={row.commissionThb} showPlus={false} /></TableCell>
                        <TableCell className="text-right"><AdminTableAmount value={row.bonusesThb} showPlus={false} /></TableCell>
                        <TableCell className="text-right text-amber-800">
                          {Number(row.heldBonusesThb) > 0 ? (
                            <AdminTableAmount value={row.heldBonusesThb} showPlus={false} />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(row.clawbackThb) > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-rose-600">
                              <RotateCcw className="h-3 w-3" />
                              <AdminTableAmount value={row.clawbackThb} showPlus={false} />
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right ${marginToneClass(row.grossMarginThb)}`}>
                          <AdminTableAmount value={row.grossMarginThb} showPlus className="inline" />
                        </TableCell>
                        <TableCell className={`text-right ${marginToneClass(row.netMarginThb)}`}>
                          <AdminTableAmount value={row.netMarginThb} showPlus className="inline" />
                        </TableCell>
                        <TableCell className={`text-right ${roiToneClass(row.roiIndex)}`}>
                          {row.roiIndex != null ? Number(row.roiIndex).toFixed(2) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/40 to-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-brand" />
              Динамика воронки
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            {!chartRows.length ? (
              <FinTechEmptyState title="Нет данных" description="Появятся после кликов." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="clicks" name="Клики" fill="#7c3aed" opacity={0.35} barSize={8} />
                  <Line yAxisId="right" type="monotone" dataKey="earnedThb" name="Earned" stroke="#d97706" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="cursor-pointer select-none" onClick={() => setShowClicksJournal((v) => !v)}>
            <div className="flex items-center gap-2">
              {showClicksJournal ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">Журнал кликов</CardTitle>
            </div>
          </CardHeader>
          {showClicksJournal ? (
            <CardContent className="overflow-x-auto">
              {!rows.length ? (
                <FinTechEmptyState title="Пусто" description="Нет кликов за период." />
              ) : (
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Click</TableHead>
                      <TableHead>Реферер</TableHead>
                      <TableHead>UTM</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs truncate max-w-[90px]">{row.click_id}</TableCell>
                        <TableCell className="text-sm">{row.referrer_label}</TableCell>
                        <TableCell className="text-xs">{row.utm_source || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {Number(row.earnedThb) > 0 ? (
                            <button type="button" className="hover:text-brand" onClick={() => void openLedger(row.id, row.click_id)}>
                              <AdminTableAmount value={row.earnedThb} showPlus={false} />
                            </button>
                          ) : '0'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          ) : null}
        </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={referrerDetailOpen} onOpenChange={setReferrerDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{referrerDetail?.referrer?.name || 'Реферер'}</DialogTitle>
              <DialogDescription>{referrerDetail?.referrer?.referralCode}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 border-b pb-2">
              <Button type="button" size="sm" variant={referrerDetailTab === 'overview' ? 'brand' : 'outline'} onClick={() => setReferrerDetailTab('overview')}>
                Обзор
              </Button>
              <Button type="button" size="sm" variant={referrerDetailTab === 'cohort' ? 'brand' : 'outline'} onClick={() => setReferrerDetailTab('cohort')}>
                Когортный анализ
              </Button>
              <Button type="button" size="sm" variant={referrerDetailTab === 'funnel' ? 'brand' : 'outline'} onClick={() => setReferrerDetailTab('funnel')}>
                Воронка
              </Button>
            </div>
            {referrerDetailLoading ? (
              <p className="text-sm text-slate-500">Загрузка…</p>
            ) : referrerDetailTab === 'funnel' ? (
              <ReferrerPersonalFunnel funnel={referrerDetail?.funnel} />
            ) : referrerDetailTab === 'cohort' ? (
              !referrerDetail?.cohortSeries?.length ? (
                <FinTechEmptyState title="Нет когорт" description="За период нет данных по месяцам." />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Месяц</TableHead>
                        <TableHead className="text-right">Привлеч.</TableHead>
                        <TableHead className="text-right">Брони</TableHead>
                        <TableHead className="text-right">Комиссия</TableHead>
                        <TableHead className="text-right">Бонусы</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrerDetail.cohortSeries.map((c) => (
                        <TableRow key={c.cohortMonth}>
                          <TableCell className="font-medium">{c.cohortMonth}</TableCell>
                          <TableCell className="text-right">{c.referredUsersCount}</TableCell>
                          <TableCell className="text-right">{c.bookingsCount}</TableCell>
                          <TableCell className="text-right"><AdminTableAmount value={c.commissionThb} showPlus={false} /></TableCell>
                          <TableCell className="text-right"><AdminTableAmount value={c.bonusesThb} showPlus={false} /></TableCell>
                          <TableCell className={`text-right ${marginToneClass(c.grossMarginThb)}`}>
                            <AdminTableAmount value={c.grossMarginThb} showPlus className="inline" />
                          </TableCell>
                          <TableCell className={`text-right ${marginToneClass(c.netMarginThb)}`}>
                            <AdminTableAmount value={c.netMarginThb} showPlus className="inline" />
                          </TableCell>
                          <TableCell className={`text-right ${roiToneClass(c.roiIndex)}`}>
                            {c.roiIndex != null ? Number(c.roiIndex).toFixed(2) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : referrerDetail ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6 text-sm">
                  {[
                    ['Комиссия', referrerDetail.summary?.commissionThb, false, 'neutral'],
                    ['Бонусы', referrerDetail.summary?.bonusesThb, false, 'neutral'],
                    ['В холде', referrerDetail.summary?.heldBonusesThb, false, 'neutral'],
                    ['Clawback', referrerDetail.summary?.clawbackThb, false, 'loss'],
                    ['Gross', referrerDetail.summary?.grossMarginThb, true, 'gross'],
                    ['Net', referrerDetail.summary?.netMarginThb, true, 'net'],
                  ].map(([label, val, signed, kind]) => (
                    <div
                      key={label}
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        kind === 'gross' || kind === 'net' ? marginBgClass(val) : 'bg-slate-50 border-slate-200',
                      )}
                    >
                      <p className="text-xs text-slate-500">{label}</p>
                      <span className={kind === 'net' ? marginToneClass(val) : kind === 'gross' ? marginToneClass(val) : ''}>
                        <AdminTableAmount value={val} showPlus={signed} className="font-semibold inline" />
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm text-slate-600">
                    ROI:{' '}
                    <span className={roiToneClass(referrerDetail.summary?.roiIndex)}>
                      {referrerDetail.summary?.roiIndex != null
                        ? Number(referrerDetail.summary.roiIndex).toFixed(2)
                        : 'n/a'}
                    </span>
                  </p>
                </div>
                {Number(referrerDetail.summary?.heldBonusesThb) > 0 ? (
                  <p className="text-sm text-amber-900 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                    В холде (earned_held):{' '}
                    <AdminTableAmount
                      value={referrerDetail.summary.heldBonusesThb}
                      showPlus={false}
                      className="inline font-semibold"
                    />
                    {' '}
                    — разблокировка по <span className="font-mono text-xs">unlock_at</span> в ledger ниже.
                  </p>
                ) : null}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Привлечённые</h3>
                  {(referrerDetail.referredUsers || []).slice(0, 8).map((u) => (
                    <div key={u.refereeId} className="mb-2 rounded border p-2 text-sm">
                      <Link href={`/admin/users/${u.refereeId}`} className="text-brand hover:underline">{u.name}</Link>
                      <span className="ml-2 text-xs text-slate-500">{u.bookingsCount} броней</span>
                    </div>
                  ))}
                </div>
                {(referrerDetail.ledger || []).length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Ledger за период</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table className="min-w-[640px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Бронь</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Разблокировка</TableHead>
                            <TableHead>Тип</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referrerDetail.ledger.slice(0, 24).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-xs max-w-[120px] truncate">
                                {row.bookingId ? (
                                  <Link
                                    href={`/admin/bookings/${row.bookingId}`}
                                    className="text-brand hover:underline"
                                  >
                                    {row.bookingId}
                                  </Link>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <AdminTableAmount value={row.amountThb} showPlus={false} />
                              </TableCell>
                              <TableCell>
                                <AdminStatusPill status={row.status} />
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                {row.status === 'earned_held' && row.unlockAt
                                  ? formatDateTime(row.unlockAt)
                                  : row.status === 'earned' && row.earnedAt
                                    ? formatDateTime(row.earnedAt)
                                    : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{row.type || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ledger по клику</DialogTitle>
              <DialogDescription className="font-mono text-xs">{ledgerData?.clickId}</DialogDescription>
            </DialogHeader>
            {ledgerLoading ? (
              <p className="text-sm">Загрузка…</p>
            ) : (
              <p className="text-sm">
                Earned:{' '}
                <AdminTableAmount value={ledgerData?.earnedTotalThb} showPlus={false} className="inline font-semibold" />
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
