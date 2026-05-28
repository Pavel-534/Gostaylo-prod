'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const EMPTY_FORM = {
  name: '',
  version: '1',
  holdDays: '',
  splitRatio: '',
  minBookingValueThb: '',
  applySplitInProduction: false,
  shadowTrafficPct: '10',
  campaignSlug: '',
  effectiveFrom: '',
  effectiveTo: '',
  priority: '0',
  isActive: true,
  isShadow: false,
};

function defaultDateFrom() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReferralRewardRulesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ includeStats: '1' });
      if (dateFrom) q.set('dateFrom', new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
      if (dateTo) q.set('dateTo', new Date(`${dateTo}T23:59:59.999Z`).toISOString());
      const res = await fetch(`/api/v2/admin/referral/reward-rules?${q}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'RULES_LOAD_FAILED');
      setRules(Array.isArray(json.data) ? json.data : []);
      setCampaignOptions(Array.isArray(json.campaignOptions) ? json.campaignOptions : []);
      setStats(json.stats || null);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить правила');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const productionActive = useMemo(
    () => rules.find((r) => r.isActive && !r.isShadow),
    [rules],
  );
  const shadowActive = useMemo(() => rules.find((r) => r.isActive && r.isShadow), [rules]);

  function startEdit(row) {
    setEditingId(String(row?.id || ''));
    setForm({
      name: String(row?.name || ''),
      version: String(row?.version ?? 1),
      holdDays: row?.rules?.hold_days != null ? String(row.rules.hold_days) : '',
      splitRatio: row?.rules?.split_ratio != null ? String(row.rules.split_ratio) : '',
      minBookingValueThb:
        row?.rules?.min_booking_value_thb != null ? String(row.rules.min_booking_value_thb) : '',
      applySplitInProduction: row?.rules?.apply_split_in_production === true,
      shadowTrafficPct: String(row?.shadowTrafficPct ?? 10),
      campaignSlug: row?.campaignSlug || '',
      effectiveFrom: row?.effectiveFrom ? new Date(row.effectiveFrom).toISOString().slice(0, 16) : '',
      effectiveTo: row?.effectiveTo ? new Date(row.effectiveTo).toISOString().slice(0, 16) : '',
      priority: String(row?.priority ?? 0),
      isActive: row?.isActive !== false,
      isShadow: row?.isShadow === true,
    });
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  async function saveRule() {
    if (!form.name.trim()) {
      toast.error('Укажите название правила');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        name: form.name.trim(),
        version: Number(form.version) || 1,
        isActive: form.isActive,
        isShadow: form.isShadow,
        shadowTrafficPct: Number(form.shadowTrafficPct) || 0,
        campaignSlug: form.campaignSlug.trim() || null,
        effectiveFrom: form.effectiveFrom
          ? new Date(form.effectiveFrom).toISOString()
          : new Date().toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
        priority: Number(form.priority) || 0,
        rules: {
          hold_days: form.holdDays !== '' ? Number(form.holdDays) : null,
          split_ratio: form.splitRatio !== '' ? Number(form.splitRatio) : null,
          min_booking_value_thb:
            form.minBookingValueThb !== '' ? Number(form.minBookingValueThb) : null,
          apply_split_in_production: form.applySplitInProduction === true,
        },
      };
      const res = await fetch(
        editingId
          ? `/api/v2/admin/referral/reward-rules/${encodeURIComponent(editingId)}`
          : '/api/v2/admin/referral/reward-rules',
        {
          method: editingId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'RULE_SAVE_FAILED');
      toast.success(editingId ? 'Правило обновлено' : 'Правило создано');
      resetForm();
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    try {
      const res = await fetch(`/api/v2/admin/referral/reward-rules/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'TOGGLE_FAILED');
      toast.success(row.isActive ? 'Правило выключено' : 'Правило активировано');
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось изменить статус');
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/marketing/rules"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Правила и настройки
          </Link>
          <h1 className="text-2xl font-bold text-slate-950">A/B правила начислений</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Stage 123.1 — production-ready: единый policy-resolver, rollout-флаг split/min и trace в
            ledger. Базовая экономика (маржа + safety cap 95%) не меняется.
          </p>
        </div>
        <Button type="button" variant="brand" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Production
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {productionActive ? (
              <p>
                <span className="font-semibold">{productionActive.name}</span> · v
                {productionActive.version} · hold {productionActive.rules?.hold_days ?? '—'} дн.
              </p>
            ) : (
              <p className="text-slate-600">Нет активного production-правила — hold из Marketing settings.</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-700" />
              Shadow A/B
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {shadowActive ? (
              <p>
                <span className="font-semibold">{shadowActive.name}</span> · {shadowActive.shadowTrafficPct}%
                трафика · только metadata
              </p>
            ) : (
              <p className="text-slate-600">Shadow выключен.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Статистика A/B (ledger metadata)</CardTitle>
          <CardDescription>Агрегат по reward_rule_version и shadow-сэмплам за период</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label htmlFor="stats-from">С</Label>
              <Input
                id="stats-from"
                type="date"
                className="mt-1"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="stats-to">По</Label>
              <Input
                id="stats-to"
                type="date"
                className="mt-1"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">Production (применено)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Версия</TableHead>
                    <TableHead className="text-right">Начислений</TableHead>
                    <TableHead className="text-right">Σ ฿</TableHead>
                    <TableHead className="text-right">В холде</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.production || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-slate-500">
                        Нет данных за период
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.production.map((row) => (
                      <TableRow key={String(row.ruleVersion)}>
                        <TableCell>
                          v{row.ruleVersion ?? '—'}
                          {row.ruleName ? (
                            <span className="block text-xs text-slate-500">{row.ruleName}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.accrualCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(row.totalThb).toLocaleString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.heldCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">Shadow (сэмплы)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Версия</TableHead>
                    <TableHead className="text-right">Сэмплов</TableHead>
                    <TableHead className="text-right">Would block</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.shadow || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-slate-500">
                        Shadow-сэмплов нет
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.shadow.map((row) => (
                      <TableRow key={String(row.ruleVersion)}>
                        <TableCell>v{row.ruleVersion}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.sampleCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.wouldBlockCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Редактировать' : 'Новое правило'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Название</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Версия</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                />
              </div>
              <div>
                <Label>Приоритет</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Shadow mode</Label>
                <p className="text-xs text-slate-500">Не меняет hold/суммы на проде</p>
              </div>
              <Switch
                checked={form.isShadow}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isShadow: v }))}
              />
            </div>
            {form.isShadow ? (
              <div>
                <Label>% трафика (0–100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.shadowTrafficPct}
                  onChange={(e) => setForm((f) => ({ ...f, shadowTrafficPct: e.target.value }))}
                />
              </div>
            ) : null}
            <div>
              <Label>Hold (дней)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                placeholder="14"
                value={form.holdDays}
                onChange={(e) => setForm((f) => ({ ...f, holdDays: e.target.value }))}
              />
            </div>
            <div>
              <Label>Split ratio (audit)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                placeholder="0.5"
                value={form.splitRatio}
                onChange={(e) => setForm((f) => ({ ...f, splitRatio: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Production rollout (split/min)</Label>
                <p className="text-xs text-slate-500">
                  Если ON — split_ratio/min_booking_value_thb реально влияют на начисление.
                </p>
              </div>
              <Switch
                checked={form.applySplitInProduction}
                onCheckedChange={(v) => setForm((f) => ({ ...f, applySplitInProduction: v }))}
              />
            </div>
            <div>
              <Label>Min booking ฿ (shadow: would_block)</Label>
              <Input
                type="number"
                min={0}
                value={form.minBookingValueThb}
                onChange={(e) => setForm((f) => ({ ...f, minBookingValueThb: e.target.value }))}
              />
            </div>
            <div>
              <Label>Кампания (опц.)</Label>
              <Select
                value={form.campaignSlug || '__all__'}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, campaignSlug: value === '__all__' ? '' : value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все кампании" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Все кампании</SelectItem>
                  {campaignOptions.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Активно</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="brand" disabled={saving} onClick={() => void saveRule()}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '…' : 'Сохранить'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Все правила</CardTitle>
            <CardDescription>{rules.length} записей</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>v</TableHead>
                  <TableHead>Режим</TableHead>
                  <TableHead>Hold</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="tabular-nums">{row.version}</TableCell>
                    <TableCell>
                      {row.isShadow ? (
                        <Badge variant="outline" className="border-violet-300 text-violet-900">
                          Shadow {row.shadowTrafficPct}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-900">
                          Production
                        </Badge>
                      )}
                      {row.isActive ? (
                        <Badge className="ml-1 bg-emerald-600">ON</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-1">
                          OFF
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.rules?.hold_days != null ? `${row.rules.hold_days} дн` : '—'}
                      {row.rules?.apply_split_in_production ? (
                        <span className="ml-2 text-xs text-emerald-700">split ON</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void toggleActive(row)}>
                        {row.isActive ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rules.length && !loading ? (
              <p className="py-6 text-center text-sm text-slate-500">
                <Plus className="mx-auto mb-2 h-5 w-5 opacity-50" />
                Создайте первое правило слева
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
