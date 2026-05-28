'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Download, Pause, Pencil, Play, Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CampaignBudgetAlertBanner } from '@/components/admin/referral/CampaignBudgetAlertBanner';
import { CampaignBudgetUsageBadge, CampaignStatusBadge } from '@/components/admin/referral/CampaignStatusBadge';
import { formatDaysUntilExpiry } from '@/lib/admin/referral-campaign-ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const EMPTY_FORM = {
  name: '',
  slug: '',
  maxBudgetThb: '',
  campaignExpiresAt: '',
  overrideHoldDays: '',
  isActive: true,
};

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

export default function MarketingCampaignsAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [referralCodes, setReferralCodes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState('');
  const [selectedCodeId, setSelectedCodeId] = useState('');
  const [selectedCampaignSlug, setSelectedCampaignSlug] = useState('__none__');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/admin/referral/campaigns?includeCodes=1', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CAMPAIGN_LOAD_FAILED');
      setCampaigns(Array.isArray(json?.data) ? json.data : []);
      setReferralCodes(Array.isArray(json?.codes) ? json.codes : []);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить кампании');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCampaigns = useMemo(
    () => campaigns.filter((row) => String(row?.status || '') === 'active'),
    [campaigns],
  );

  const budgetWarnings = useMemo(
    () => campaigns.filter((c) => c.budgetAlertLevel === 'warning' || c.budgetAlertLevel === 'critical'),
    [campaigns],
  );

  function startEdit(row) {
    setEditingSlug(String(row?.slug || ''));
    setForm({
      name: String(row?.name || ''),
      slug: String(row?.slug || ''),
      maxBudgetThb: row?.maxBudgetThb != null ? String(row.maxBudgetThb) : '',
      campaignExpiresAt: row?.campaignExpiresAt ? new Date(row.campaignExpiresAt).toISOString().slice(0, 16) : '',
      overrideHoldDays: row?.overrideHoldDays != null ? String(row.overrideHoldDays) : '',
      isActive: row?.isActive !== false,
    });
  }

  function resetForm() {
    setEditingSlug('');
    setForm(EMPTY_FORM);
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        maxBudgetThb: form.maxBudgetThb ? Number(form.maxBudgetThb) : null,
        overrideHoldDays: form.overrideHoldDays === '' ? null : Number(form.overrideHoldDays),
        campaignExpiresAt: form.campaignExpiresAt
          ? new Date(form.campaignExpiresAt).toISOString()
          : null,
      };
      const url = editingSlug
        ? `/api/v2/admin/referral/campaigns/${encodeURIComponent(editingSlug)}`
        : '/api/v2/admin/referral/campaigns';
      const method = editingSlug ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CAMPAIGN_SAVE_FAILED');
      toast.success(editingSlug ? 'Кампания обновлена' : 'Кампания создана');
      resetForm();
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось сохранить кампанию');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(row) {
    const slug = String(row?.slug || '');
    if (!slug) return;
    try {
      const res = await fetch(`/api/v2/admin/referral/campaigns/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: row?.isActive === false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CAMPAIGN_TOGGLE_FAILED');
      toast.success(row?.isActive === false ? 'Кампания активирована' : 'Кампания поставлена на паузу');
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось изменить статус');
    }
  }

  async function bindCode() {
    if (!selectedCodeId) {
      toast.error('Выберите реферальный код');
      return;
    }
    try {
      const res = await fetch('/api/v2/admin/referral/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind_code',
          codeId: selectedCodeId,
          campaignSlug: selectedCampaignSlug && selectedCampaignSlug !== '__none__' ? selectedCampaignSlug : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'BIND_CODE_FAILED');
      toast.success(selectedCampaignSlug ? 'Код привязан к кампании' : 'Кампания у кода очищена');
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось привязать код');
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Кампании</h1>
          <p className="mt-1 text-sm text-slate-600">Управляйте бюджетом, сроком и hold override без изменения базовой экономики.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch('/api/v2/admin/referral/campaigns?format=csv', {
                  credentials: 'include',
                });
                if (!res.ok) throw new Error('CSV_EXPORT_FAILED');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'referral-campaigns.csv';
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Список кампаний экспортирован');
              } catch (e) {
                toast.error(e?.message || 'Ошибка экспорта');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV всех кампаний
          </Button>
          <Button type="button" variant="brand" onClick={resetForm}>
            <Plus className="mr-2 h-4 w-4" />
            Создать новую
          </Button>
        </div>
      </div>

      {budgetWarnings.length > 0 ? (
        <div className="space-y-2">
          {budgetWarnings.slice(0, 3).map((row) => (
            <CampaignBudgetAlertBanner key={row.slug} campaign={row} />
          ))}
          {budgetWarnings.length > 3 ? (
            <p className="text-xs text-slate-500">Ещё {budgetWarnings.length - 3} кампаний с предупреждением по бюджету.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>{editingSlug ? 'Редактирование кампании' : 'Новая кампания'}</CardTitle>
            <CardDescription>Slug уникален. Override hold ограничен 0..90 дней.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Название</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Referral Summer 2026" />
            </div>
            <div className="space-y-1">
              <Label>Campaign slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} disabled={!!editingSlug} placeholder="summer-2026" />
            </div>
            <div className="space-y-1">
              <Label>Max Budget THB</Label>
              <Input type="number" min={0} step="0.01" value={form.maxBudgetThb} onChange={(e) => setForm((p) => ({ ...p, maxBudgetThb: e.target.value }))} placeholder="50000" />
            </div>
            <div className="space-y-1">
              <Label>Expires At</Label>
              <Input type="datetime-local" value={form.campaignExpiresAt} onChange={(e) => setForm((p) => ({ ...p, campaignExpiresAt: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Override Hold Days</Label>
              <Input type="number" min={0} max={90} step="1" value={form.overrideHoldDays} onChange={(e) => setForm((p) => ({ ...p, overrideHoldDays: e.target.value }))} placeholder="14" />
            </div>
            <div className="space-y-1">
              <Label>Статус</Label>
              <Select value={form.isActive ? '1' : '0'} onValueChange={(v) => setForm((p) => ({ ...p, isActive: v === '1' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Активна</SelectItem>
                  <SelectItem value="0">Пауза</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="brand" onClick={() => void saveCampaign()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Сохраняю...' : editingSlug ? 'Сохранить изменения' : 'Создать кампанию'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Список кампаний</CardTitle>
            <CardDescription>Статус вычисляется из паузы, срока и остатка бюджета.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : (
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Max Budget</TableHead>
                    <TableHead className="text-right">Потрачено</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Override Hold</TableHead>
                    <TableHead>До окончания</TableHead>
                    <TableHead>Expires At</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((row) => (
                      <TableRow
                        key={row.slug}
                        className="cursor-pointer hover:bg-brand/5"
                        onClick={() => router.push(`/admin/marketing/campaigns/${encodeURIComponent(row.slug)}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1">
                            {row.name}
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CampaignStatusBadge status={row.status} />
                            <CampaignBudgetUsageBadge
                              budgetAlertLevel={row.budgetAlertLevel}
                              budgetUsagePct={row.budgetUsagePct}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.maxBudgetThb != null ? formatThb(row.maxBudgetThb) : '∞'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatThb(row.spentThb)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.remainingBudgetThb != null ? formatThb(row.remainingBudgetThb) : '∞'}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.overrideHoldDays != null ? `${row.overrideHoldDays} дн` : '—'}</TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {formatDaysUntilExpiry(row.campaignExpiresAt)}
                        </TableCell>
                        <TableCell>{formatDate(row.campaignExpiresAt)}</TableCell>
                        <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => startEdit(row)}><Pencil className="mr-1 h-3.5 w-3.5" />Ред.</Button>
                          <Button size="sm" variant="outline" onClick={() => void toggleCampaign(row)}>
                            {row?.isActive === false ? <Play className="mr-1 h-3.5 w-3.5" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
                            {row?.isActive === false ? 'Активировать' : 'Пауза'}
                          </Button>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
        <CardHeader>
          <CardTitle>Привязка кампании к реферальному коду</CardTitle>
          <CardDescription>Применяется к выбранной реферальной ссылке (`referral_codes`).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Реферальный код</Label>
            <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
              <SelectTrigger><SelectValue placeholder="Выберите код" /></SelectTrigger>
              <SelectContent>
                {referralCodes.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.code} {row.campaign_slug ? `(${row.campaign_slug})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Кампания</Label>
            <Select value={selectedCampaignSlug} onValueChange={setSelectedCampaignSlug}>
              <SelectTrigger><SelectValue placeholder="Без кампании" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Без кампании</SelectItem>
                {activeCampaigns.map((row) => (
                  <SelectItem key={row.slug} value={row.slug}>{row.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="brand" onClick={() => void bindCode()}>Сохранить привязку</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

