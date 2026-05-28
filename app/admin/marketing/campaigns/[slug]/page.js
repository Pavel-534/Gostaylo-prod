'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Pause,
  Play,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { CampaignBudgetAlertBanner } from '@/components/admin/referral/CampaignBudgetAlertBanner';
import { CampaignStatusBadge } from '@/components/admin/referral/CampaignStatusBadge';
import { ReferralFunnelPanel } from '@/components/admin/referral/ReferralFunnelPanel';
import { formatDaysUntilExpiry } from '@/lib/admin/referral-campaign-ui';
import { roiToneClass } from '@/lib/admin/referral-monetary-kpi';

function defaultDateFrom() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ฿`;
}

export default function ReferralCampaignDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpComment, setTopUpComment] = useState('');
  const [topUpSaving, setTopUpSaving] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (dateFrom) q.set('dateFrom', new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
      if (dateTo) q.set('dateTo', new Date(`${dateTo}T23:59:59.999Z`).toISOString());
      const res = await fetch(`/api/v2/admin/referral/campaigns/${encodeURIComponent(slug)}?${q}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CAMPAIGN_DETAIL_LOAD_FAILED');
      setData(json.data);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить кампанию');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const campaign = data?.campaign;
  const metrics = data?.metrics || {};
  const referrerRows = Array.isArray(data?.referrerRows) ? data.referrerRows : [];
  const codes = Array.isArray(data?.codes) ? data.codes : [];
  const cohortRows = Array.isArray(data?.cohortRows) ? data.cohortRows : [];
  const budgetTopups = Array.isArray(data?.budgetTopups) ? data.budgetTopups : [];

  const chartRows = useMemo(() => {
    return (data?.funnel?.chartDaily || []).map((row) => {
      const [, m, d] = String(row.date || '').split('-');
      return { ...row, label: `${d}.${m}` };
    });
  }, [data?.funnel?.chartDaily]);

  const budgetPct = useMemo(() => {
    const max = Number(campaign?.maxBudgetThb);
    const spent = Number(campaign?.spentThb) || 0;
    if (!Number.isFinite(max) || max <= 0) return null;
    return Math.min(100, Math.round((spent / max) * 100));
  }, [campaign]);

  async function downloadDetailCsv() {
    try {
      const q = new URLSearchParams({ format: 'csv' });
      if (dateFrom) q.set('dateFrom', new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
      if (dateTo) q.set('dateTo', new Date(`${dateTo}T23:59:59.999Z`).toISOString());
      const res = await fetch(
        `/api/v2/admin/referral/campaigns/${encodeURIComponent(slug)}?${q}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('CSV_EXPORT_FAILED');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-campaign_${slug}_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Детальный CSV скачан');
    } catch (e) {
      toast.error(e?.message || 'Ошибка экспорта');
    }
  }

  async function topUpBudget() {
    const add = Number(topUpAmount);
    if (!Number.isFinite(add) || add <= 0) {
      toast.error('Укажите сумму пополнения');
      return;
    }
    setTopUpSaving(true);
    try {
      const res = await fetch(`/api/v2/admin/referral/campaigns/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'top_up_budget',
          addThb: add,
          comment: topUpComment.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'TOPUP_FAILED');
      toast.success(`Бюджет увеличен на ${formatThb(add)}`);
      setTopUpAmount('');
      setTopUpComment('');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Не удалось пополнить бюджет');
    } finally {
      setTopUpSaving(false);
    }
  }

  async function togglePause() {
    try {
      const res = await fetch(`/api/v2/admin/referral/campaigns/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: campaign?.isActive === false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'TOGGLE_FAILED');
      toast.success(campaign?.isActive === false ? 'Кампания активирована' : 'Кампания на паузе');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Не удалось изменить статус');
    }
  }

  if (!slug) {
    return <p className="p-6 text-sm text-slate-500">Некорректный slug кампании.</p>;
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/marketing/campaigns"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Все кампании
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-950">{campaign?.name || slug}</h1>
            {campaign?.status ? <CampaignStatusBadge status={campaign.status} /> : null}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadDetailCsv()}>
            <Download className="mr-2 h-4 w-4" />
            CSV отчёт
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={`/admin/marketing/attribution?campaignSlug=${encodeURIComponent(slug)}`}>
              Денежный пульт
            </Link>
          </Button>
          <Button type="button" variant="brand" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {campaign ? <CampaignBudgetAlertBanner campaign={campaign} /> : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Период аналитики</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="camp-from">С</Label>
            <Input id="camp-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="camp-to">По</Label>
            <Input id="camp-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Клики', metrics.clicksCount ?? 0, null],
          ['CR → регистрация', formatPct(metrics.clickToSignupPct), null],
          ['Earned', metrics.earnedThb ?? 0, 'thb'],
          ['Расход (spend)', metrics.spendThb ?? 0, 'thb'],
          ['Suspicious', metrics.suspiciousConversionsCount ?? 0, null],
          ['% suspicious', formatPct(metrics.suspiciousConversionPct ?? 0), null],
          ['ROI', metrics.roiIndex != null ? Number(metrics.roiIndex).toFixed(2) : '—', 'roi'],
          ['Остаток бюджета', campaign?.remainingBudgetThb != null ? formatThb(campaign.remainingBudgetThb) : '∞', null],
        ].map(([label, value, kind]) => (
          <Card key={label} className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">{label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {kind === 'thb' ? (
                  <AdminTableAmount value={value} showPlus={false} className="inline text-xl font-bold" />
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

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="border-emerald-100 bg-emerald-50/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-700" />
              Бюджет кампании
            </CardTitle>
            <CardDescription>
              Потрачено {formatThb(campaign?.spentThb ?? 0)} из{' '}
              {campaign?.maxBudgetThb != null ? formatThb(campaign.maxBudgetThb) : 'без лимита'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetPct != null ? (
              <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetPct >= 100
                      ? 'bg-rose-600'
                      : budgetPct >= 90
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label htmlFor="topup">Пополнить бюджет (+฿)</Label>
                <Input
                  id="topup"
                  type="number"
                  min={0}
                  step="100"
                  placeholder="10000"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-[2] min-w-[180px]">
                <Label htmlFor="topup-comment">Комментарий</Label>
                <Input
                  id="topup-comment"
                  placeholder="Причина пополнения (опционально)"
                  value={topUpComment}
                  onChange={(e) => setTopUpComment(e.target.value)}
                />
              </div>
              <Button type="button" variant="brand" disabled={topUpSaving} onClick={() => void topUpBudget()}>
                {topUpSaving ? '…' : 'Пополнить'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void togglePause()}>
                {campaign?.isActive === false ? (
                  <>
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Активировать
                  </>
                ) : (
                  <>
                    <Pause className="mr-1 h-3.5 w-3.5" />
                    Пауза
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-600">
              Hold override: {campaign?.overrideHoldDays != null ? `${campaign.overrideHoldDays} дн.` : 'глобальный'} ·
              до окончания: {formatDaysUntilExpiry(campaign?.campaignExpiresAt)} · истекает:{' '}
              {campaign?.campaignExpiresAt
                ? new Date(campaign.campaignExpiresAt).toLocaleString('ru-RU')
                : 'без срока'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Привязанные коды</CardTitle>
            <CardDescription>{codes.length} referral_codes</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[200px] overflow-y-auto text-sm space-y-2">
            {codes.length === 0 ? (
              <p className="text-slate-500">Нет привязанных кодов.</p>
            ) : (
              codes.slice(0, 8).map((row) => (
                <div key={row.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                  <span className="font-mono text-xs">{row.code}</span>
                  <span className="text-xs text-slate-500 truncate">{row.ownerLabel}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {loading && !data ? (
        <p className="text-sm text-slate-500">Загрузка…</p>
      ) : (
        <Tabs defaultValue="funnel" className="space-y-4">
          <TabsList>
            <TabsTrigger value="funnel">Воронка</TabsTrigger>
            <TabsTrigger value="referrers">Рефереры ({referrerRows.length})</TabsTrigger>
            <TabsTrigger value="codes">Коды ({codes.length})</TabsTrigger>
            <TabsTrigger value="cohort">Когорты</TabsTrigger>
            <TabsTrigger value="topups">История пополнений ({budgetTopups.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel">
            <ReferralFunnelPanel funnel={data?.funnel} chartRows={chartRows} />
          </TabsContent>

          <TabsContent value="referrers">
            <Card className="shadow-sm">
              <CardContent className="overflow-x-auto pt-6">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Реферер</TableHead>
                      <TableHead className="text-right">Клики</TableHead>
                      <TableHead className="text-right">Привлеч.</TableHead>
                      <TableHead className="text-right">Брони</TableHead>
                      <TableHead className="text-right">Бонусы</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrerRows.map((row) => (
                      <TableRow key={row.referrerId}>
                        <TableCell>
                          <Link href={`/admin/users/${row.referrerId}`} className="font-medium text-brand hover:underline">
                            {row.name}
                          </Link>
                          <p className="text-xs text-slate-500">{row.referralCode}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.clicksCount ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.referredUsersCount ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.bookingsCount ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <AdminTableAmount value={row.bonusesThb} showPlus={false} />
                        </TableCell>
                        <TableCell className="text-right">
                          <AdminTableAmount value={row.netMarginThb} showPlus className="inline" />
                        </TableCell>
                        <TableCell className={`text-right ${roiToneClass(row.roiIndex)}`}>
                          {row.roiIndex != null ? Number(row.roiIndex).toFixed(2) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="codes">
            <Card className="shadow-sm">
              <CardContent className="overflow-x-auto pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Код</TableHead>
                      <TableHead>Владелец</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Потрачено по коду</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.code}</TableCell>
                        <TableCell>
                          <Link href={`/admin/users/${row.userId}`} className="text-brand hover:underline text-sm">
                            {row.ownerLabel}
                          </Link>
                        </TableCell>
                        <TableCell>{row.isActive ? 'Активен' : 'Выключен'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatThb(row.currentSpentThb)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topups">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">История пополнений бюджета</CardTitle>
                <CardDescription>
                  Аудит в `metadata.budget_topups` — кто, когда и на сколько увеличил лимит.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {budgetTopups.length === 0 ? (
                  <p className="text-sm text-slate-500">Пополнений ещё не было.</p>
                ) : (
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Кто пополнил</TableHead>
                        <TableHead>Комментарий</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetTopups.map((row) => (
                        <TableRow key={row.id || row.atIso}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.atIso
                              ? new Date(row.atIso).toLocaleString('ru-RU', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            +{formatThb(row.amountThb)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <p className="font-medium">{row.adminName || row.adminEmail || '—'}</p>
                            {row.adminUserId ? (
                              <Link
                                href={`/admin/users/${row.adminUserId}`}
                                className="text-xs text-brand hover:underline font-mono"
                              >
                                {row.adminUserId}
                              </Link>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 max-w-[280px]">
                            {row.comment || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cohort">
            <Card className="shadow-sm">
              <CardContent className="overflow-x-auto pt-6">
                {!cohortRows.length ? (
                  <p className="text-sm text-slate-500">Нет когорт за период.</p>
                ) : (
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Реферер</TableHead>
                        <TableHead>Месяц</TableHead>
                        <TableHead className="text-right">Привлеч.</TableHead>
                        <TableHead className="text-right">Брони</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cohortRows.map((row) => (
                        <TableRow key={`${row.referrerId}-${row.cohortMonth}`}>
                          <TableCell className="text-sm">{row.referrerName || row.referrerId}</TableCell>
                          <TableCell>{row.cohortMonth}</TableCell>
                          <TableCell className="text-right">{row.referredUsersCount}</TableCell>
                          <TableCell className="text-right">{row.bookingsCount}</TableCell>
                          <TableCell className="text-right">
                            <AdminTableAmount value={row.netMarginThb} showPlus className="inline" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
