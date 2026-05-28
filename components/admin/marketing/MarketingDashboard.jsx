'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { CampaignBudgetAlertBanner } from '@/components/admin/referral/CampaignBudgetAlertBanner';
import { CampaignStatusBadge } from '@/components/admin/referral/CampaignStatusBadge';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const FINTECH_NAVY = '#0f172a';

function defaultDateFrom() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`).toISOString();
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

export default function MarketingDashboard() {
  const [loading, setLoading] = useState(true);
  const [attribution, setAttribution] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [rules, setRules] = useState([]);
  const [fraudOpen, setFraudOpen] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = defaultDateFrom();
      const to = new Date().toISOString();
      const q = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        limit: '20',
      });
      const [attrRes, campRes, rulesRes, fraudRes] = await Promise.all([
        fetch(`/api/v2/admin/referral/attribution?${q}`, { credentials: 'include', cache: 'no-store' }),
        fetch('/api/v2/admin/referral/campaigns', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/v2/admin/referral/reward-rules', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/v2/admin/referral/fraud-queue?status=open&limit=20', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      const attrJson = await attrRes.json().catch(() => ({}));
      const campJson = await campRes.json().catch(() => ({}));
      const rulesJson = await rulesRes.json().catch(() => ({}));
      const fraudJson = await fraudRes.json().catch(() => ({}));
      if (!attrRes.ok || !attrJson?.success) throw new Error(attrJson?.error || 'DASHBOARD_ATTR_FAILED');
      setAttribution(attrJson.data || null);
      setCampaigns(Array.isArray(campJson?.data) ? campJson.data : []);
      setRules(Array.isArray(rulesJson?.data) ? rulesJson.data : []);
      setFraudOpen(Array.isArray(fraudJson?.data) ? fraudJson.data : []);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить дашборд');
      setAttribution(null);
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
  const chartRows = useMemo(() => {
    return (attribution?.chartDaily || []).map((row) => {
      const [, m, d] = String(row.date || '').split('-');
      return { ...row, label: `${d}.${m}` };
    });
  }, [attribution?.chartDaily]);

  const activeCampaigns = campaigns.filter((c) => c.isActive !== false && c.status === 'active');
  const budgetAlerts = campaigns.filter(
    (c) => c.budgetAlertLevel === 'warning' || c.budgetAlertLevel === 'critical',
  );
  const productionRules = rules.filter((r) => r.is_active && !r.is_shadow);
  const shadowRules = rules.filter((r) => r.is_shadow);

  const quickLinks = [
    { href: '/admin/marketing/attribution', label: 'Денежный пульт', icon: Banknote },
    { href: '/admin/marketing/campaigns', label: 'Кампании', icon: Megaphone },
    { href: '/admin/marketing/fraud-queue', label: 'Fraud Queue', icon: ShieldAlert },
    { href: '/admin/marketing/reward-rules', label: 'A/B правила', icon: Sparkles },
    { href: '/admin/marketing/settings', label: 'Настройки', icon: TrendingUp },
    { href: '/admin/marketing/promos', label: 'Промокоды', icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Маркетинг &amp; рефералка</h1>
          <p className="mt-1 text-sm text-slate-600">
            Обзор за 30 дней: деньги, риски, кампании и правила — без лишних переходов.
          </p>
        </div>
        <Button type="button" variant="brand" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {(budgetAlerts.length > 0 || Number(metrics.suspiciousConversionsCount) > 0 || fraudOpen.length > 0) && (
        <div className="space-y-3">
          {budgetAlerts.slice(0, 2).map((c) => (
            <CampaignBudgetAlertBanner key={c.slug} campaign={c} />
          ))}
          {Number(metrics.suspiciousConversionsCount) > 0 ? (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-amber-950">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Подозрительных конверсий: {metrics.suspiciousConversionsCount} (
                  {formatPct(metrics.suspiciousConversionPct)})
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/marketing/attribution">Открыть аналитику</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {fraudOpen.length > 0 ? (
            <Card className="border-rose-200 bg-rose-50/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-rose-950">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  В очереди fraud-review: {fraudOpen.length} открытых кейсов
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/marketing/fraud-queue">Открыть очередь</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {[
          ['Клики', metrics.clicks ?? 0, null],
          ['Регистрации', metrics.registrations ?? 0, null],
          ['Earned', metrics.earnedBonusesThb ?? 0, 'thb'],
          ['Расход', metrics.referralSpendThb ?? 0, 'thb'],
          ['ROI', metrics.roiIndex != null ? Number(metrics.roiIndex).toFixed(2) : '—', 'roi'],
          ['Promo tank', metrics.promoTankBalanceThb ?? 0, 'thb'],
          ['Suspicious', metrics.suspiciousConversionsCount ?? 0, null],
          ['% suspicious', formatPct(metrics.suspiciousConversionPct ?? 0), null],
        ].map(([label, value, kind]) => (
          <Card key={label} className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">{label}</CardDescription>
              <CardTitle className="text-lg tabular-nums">
                {kind === 'thb' ? (
                  <AdminTableAmount value={value} showPlus={false} className="inline text-lg font-bold" />
                ) : kind === 'roi' ? (
                  <span className={roiToneClass(metrics.roiIndex)}>{value}</span>
                ) : (
                  value
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: FINTECH_NAVY }}>
              Динамика (30 дней)
            </CardTitle>
            <CardDescription>Клики, регистрации и earned по дням</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="clicks" stroke="#0d9488" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="registrations" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="earnedThb" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand/40 hover:bg-brand/5"
                >
                  <span className="flex items-center gap-2 text-slate-800">
                    <Icon className="h-4 w-4 text-brand" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Активные кампании</CardTitle>
              <CardDescription>{activeCampaigns.length} из {campaigns.length}</CardDescription>
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
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Правила начислений</CardTitle>
              <CardDescription>
                Production: {productionRules.length} · Shadow: {shadowRules.length}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/marketing/reward-rules">Управлять</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {rules.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
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
  );
}
