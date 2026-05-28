'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleHelp, Save, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';

function FieldHint({ children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 align-middle text-slate-400 hover:text-slate-700"
          aria-label="Пояснение"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm border-slate-800 bg-slate-900 text-xs font-normal leading-snug text-slate-50"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function pct(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export default function MarketingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [promoPotThb, setPromoPotThb] = useState(null);
  const [tankLog, setTankLog] = useState([]);
  const [tankLogLoading, setTankLogLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [retryBookingId, setRetryBookingId] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [form, setForm] = useState({
    referralReinvestmentPercent: 70,
    acquiringFeePercent: 0,
    operationalReservePercent: 0,
    partnerActivationBonus: 500,
    mlmLevel1Percent: 70,
    mlmLevel2Percent: 30,
    payoutToInternalRatio: 70,
    referralHoldDays: 14,
  });
  const [lastBudget, setLastBudget] = useState(null);
  const [payoutStats, setPayoutStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [res, statsRes] = await Promise.all([
          fetch('/api/admin/settings', { cache: 'no-store' }),
          fetch('/api/v2/admin/referral/payout-stats', { cache: 'no-store', credentials: 'include' }),
        ]);
        const json = await res.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        if (!res.ok || !json?.data) throw new Error(json?.error || 'LOAD_FAILED');
        if (cancelled) return;
        const s = json.data;
        setSnapshot(s);
        setForm({
          referralReinvestmentPercent: clamp(
            s.referralReinvestmentPercent ?? s.referral_reinvestment_percent ?? 70,
            0,
            95,
          ),
          acquiringFeePercent: clamp(s.acquiringFeePercent ?? s.acquiring_fee_percent ?? 0, 0, 100),
          operationalReservePercent: clamp(
            s.operationalReservePercent ?? s.operational_reserve_percent ?? 0,
            0,
            100,
          ),
          partnerActivationBonus: clamp(
            s.partnerActivationBonus ?? s.partner_activation_bonus ?? 500,
            0,
            1_000_000_000,
          ),
          mlmLevel1Percent: clamp(s.mlmLevel1Percent ?? s.mlm_level1_percent ?? 70, 0, 100),
          mlmLevel2Percent: clamp(s.mlmLevel2Percent ?? s.mlm_level2_percent ?? 30, 0, 100),
          payoutToInternalRatio: clamp(
            s.payoutToInternalRatio ?? s.payout_to_internal_ratio ?? 70,
            0,
            100,
          ),
          referralHoldDays: clamp(s.referralHoldDays ?? s.referral_hold_days ?? 14, 0, 90),
        });
        setLastBudget(s.referralSafetyBudget || null);
        if (statsRes.ok && statsJson?.success) {
          setPayoutStats(statsJson?.data || null);
        }
        const [monRes, logRes] = await Promise.all([
          fetch('/api/v2/admin/referral/pnl-monitor', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/v2/admin/referral/tank-events?type=manual&limit=25', {
            cache: 'no-store',
            credentials: 'include',
          }),
        ]);
        const monJson = await monRes.json().catch(() => ({}));
        const logJson = await logRes.json().catch(() => ({}));
        if (monRes.ok && monJson?.data?.marketingPromoPotThb != null) {
          setPromoPotThb(Number(monJson.data.marketingPromoPotThb));
        }
        if (logRes.ok && Array.isArray(logJson?.data)) {
          setTankLog(logJson.data);
        }
      } catch (error) {
        if (!cancelled) toast.error(error?.message || 'Не удалось загрузить настройки маркетинга');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mlmTotalPercent = useMemo(
    () => clamp(form.mlmLevel1Percent, 0, 100) + clamp(form.mlmLevel2Percent, 0, 100),
    [form.mlmLevel1Percent, form.mlmLevel2Percent],
  );

  async function handleSave() {
    if (!snapshot) return;
    setSaving(true);
    try {
      const payload = {
        ...snapshot,
        referralReinvestmentPercent: clamp(form.referralReinvestmentPercent, 0, 95),
        acquiringFeePercent: clamp(form.acquiringFeePercent, 0, 100),
        operationalReservePercent: clamp(form.operationalReservePercent, 0, 100),
        partnerActivationBonus: clamp(form.partnerActivationBonus, 0, 1_000_000_000),
        mlmLevel1Percent: clamp(form.mlmLevel1Percent, 0, 100),
        mlmLevel2Percent: clamp(form.mlmLevel2Percent, 0, 100),
        payoutToInternalRatio: clamp(form.payoutToInternalRatio, 0, 100),
        referral_reinvestment_percent: clamp(form.referralReinvestmentPercent, 0, 95),
        acquiring_fee_percent: clamp(form.acquiringFeePercent, 0, 100),
        operational_reserve_percent: clamp(form.operationalReservePercent, 0, 100),
        partner_activation_bonus: clamp(form.partnerActivationBonus, 0, 1_000_000_000),
        mlm_level1_percent: clamp(form.mlmLevel1Percent, 0, 100),
        mlm_level2_percent: clamp(form.mlmLevel2Percent, 0, 100),
        payout_to_internal_ratio: clamp(form.payoutToInternalRatio, 0, 100),
        referralHoldDays: clamp(form.referralHoldDays, 0, 90),
        referral_hold_days: clamp(form.referralHoldDays, 0, 90),
      };
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const details = Array.isArray(json?.details) ? json.details.join(' ') : '';
        throw new Error(details || json?.error || 'SAVE_FAILED');
      }
      setSnapshot(json?.data || payload);
      setLastBudget(json?.budget || null);
      toast.success('Настройки сохранены');
    } catch (error) {
      toast.error(error?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function refreshTankData() {
    setTankLogLoading(true);
    try {
      const [monRes, logRes] = await Promise.all([
        fetch('/api/v2/admin/referral/pnl-monitor', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/v2/admin/referral/tank-events?type=manual&limit=25', {
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);
      const monJson = await monRes.json().catch(() => ({}));
      const logJson = await logRes.json().catch(() => ({}));
      if (monRes.ok && monJson?.data?.marketingPromoPotThb != null) {
        setPromoPotThb(Number(monJson.data.marketingPromoPotThb));
      }
      if (logRes.ok && Array.isArray(logJson?.data)) {
        setTankLog(logJson.data);
      }
    } finally {
      setTankLogLoading(false);
    }
  }

  async function handleManualTopup(e) {
    e?.preventDefault?.();
    const amt = Number(topupAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Укажите сумму пополнения > 0');
      return;
    }
    setTopupBusy(true);
    try {
      const res = await fetch('/api/v2/admin/referral/pnl-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'topup',
          amountThb: amt,
          note: topupNote || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'TOPUP_FAILED');
      }
      toast.success('Бюджет пополнен');
      setTopupAmount('');
      setTopupNote('');
      await refreshTankData();
      const statsRes = await fetch('/api/v2/admin/referral/payout-stats', {
        cache: 'no-store',
        credentials: 'include',
      });
      const statsJson = await statsRes.json().catch(() => ({}));
      if (statsRes.ok && statsJson?.success) setPayoutStats(statsJson?.data || null);
    } catch (err) {
      toast.error(err?.message || 'Не удалось пополнить бюджет');
    } finally {
      setTopupBusy(false);
    }
  }

  async function handleRetryHostActivation(e) {
    e?.preventDefault?.();
    const bid = String(retryBookingId || '').trim();
    if (!bid) {
      toast.error('Укажите booking ID');
      return;
    }
    setRetryBusy(true);
    try {
      const res = await fetch('/api/v2/admin/referral/retry-host-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingId: bid }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || json?.data?.error || 'RETRY_FAILED');
      }
      toast.success('Начисление отправлено повторно');
      setRetryBookingId('');
      await refreshTankData();
    } catch (err) {
      toast.error(err?.message || 'Не удалось повторить начисление');
    } finally {
      setRetryBusy(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Загрузка настроек…</div>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              К маркетингу
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Маркетинговый бюджет и бонусы</h1>
          <p className="text-sm text-slate-600 mt-1">
            Здесь задаётся общий бюджет на акции, размер реферальных выплат и защита от убытков по марже.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Маркетинговый бюджет (пул)</CardTitle>
          <CardDescription>
            Отдельный «кошелёк» платформы на бонусы и акции. Баланс виден ниже; все движения пишутся в журнал.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="font-medium text-slate-900">Откуда пополняется бюджет</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Автоматически</strong> — небольшая доля маржи с обычных (не по рефералке) завершённых броней.
              </li>
              <li>
                <strong>Вручную</strong> — вы вводите сумму и нажимаете «Пополнить» (ниже); в журнале будет видно, кто
                пополнил.
              </li>
              <li>
                <strong>Возврат приветственного бонуса</strong> — если гость не использовал welcome-бонус в срок, сумма
                возвращается в пул по расписанию.
              </li>
            </ul>
            <p className="text-slate-600">
              <strong>На что тратится:</strong> усиленные реферальные акции, разовый бонус за активацию нового партнёра,
              при необходимости — ручное списание.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Сейчас в пуле:{' '}
              <strong>{promoPotThb != null ? `${Number(promoPotThb).toLocaleString('ru-RU')} ฿` : '—'}</strong>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshTankData()}>
              {tankLogLoading ? '…' : 'Обновить баланс и журнал'}
            </Button>
          </div>
          <form className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-4" onSubmit={handleManualTopup}>
            <div className="space-y-2">
              <Label htmlFor="manualTopupAmount">Сумма пополнения (฿)</Label>
              <Input
                id="manualTopupAmount"
                type="number"
                min={1}
                step={1}
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manualTopupNote">Комментарий (для журнала)</Label>
              <Input
                id="manualTopupNote"
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Напр. пополнение Q2"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={topupBusy}>
                {topupBusy ? 'Пополнение…' : 'Пополнить бюджет'}
              </Button>
            </div>
          </form>
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="font-medium text-slate-900">Повторить бонус за активацию партнёра</p>
            <p className="text-xs text-slate-600">
              Если бонус не прошёл из‑за пустого пула, пополните бюджет, укажите номер брони и нажмите «Повторить».
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="retryBookingId">Номер брони (ID)</Label>
                <Input
                  id="retryBookingId"
                  value={retryBookingId}
                  onChange={(e) => setRetryBookingId(e.target.value)}
                  placeholder="b-…"
                />
              </div>
              <Button type="button" variant="secondary" disabled={retryBusy} onClick={handleRetryHostActivation}>
                {retryBusy ? '…' : 'Повторить начисление'}
              </Button>
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-900 mb-2">Журнал ручных пополнений и списаний</p>
            <div className="rounded-md border border-slate-200 overflow-x-auto max-h-64 overflow-y-auto text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-200">
                    <th className="p-2">Время (UTC)</th>
                    <th className="p-2">Тип</th>
                    <th className="p-2">THB</th>
                    <th className="p-2">Кто</th>
                    <th className="p-2">Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {(tankLog || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-3 text-slate-500">
                        Пока пусто. Пополните бюджет или откройте раздел «Аудит пула» в маркетинге.
                      </td>
                    </tr>
                  ) : (
                    tankLog.map((row) => {
                      const md = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
                      const who =
                        md.admin_email || md.admin_user_id
                          ? [md.admin_email, md.admin_user_id].filter(Boolean).join(' · ')
                          : '—';
                      const note = md.note || md.trigger || '—';
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="p-2 whitespace-nowrap">{row.created_at || '—'}</td>
                          <td className="p-2">{row.entry_type}</td>
                          <td className="p-2">
                            <AdminTableAmount value={row.amount_thb} showPlus={false} className="text-xs" />
                          </td>
                          <td className="p-2 max-w-[200px] truncate" title={who}>
                            {who}
                          </td>
                          <td className="p-2 max-w-[240px] truncate" title={note}>
                            {String(note).slice(0, 120)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Бонусы</CardTitle>
          <CardDescription>
            Сколько отдавать за приглашённых гостей и партнёров и как долго держать бонус до зачисления на кошелёк.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="referralReinvestmentPercent">Доля маржи на реферальные выплаты, %</Label>
              <FieldHint>
                Максимум прибыли с одной брони, который можно раздать по рефералке. Чем ниже — тем меньше расход на
                маркетинг при тех же продажах. Система дополнительно не даст уйти в минус по общей марже.
              </FieldHint>
            </div>
            <Input
              id="referralReinvestmentPercent"
              type="number"
              min={0}
              max={95}
              step={0.1}
              value={form.referralReinvestmentPercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  referralReinvestmentPercent: clamp(e.target.value, 0, 95),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="referralHoldDays">Период охлаждения бонуса, дней</Label>
              <FieldHint>
                После завершения брони бонус виден пригласившему, но на кошелёк попадёт только через столько дней (на
                случай отмены или спора). 0 — зачисление сразу после завершения брони.
              </FieldHint>
            </div>
            <Input
              id="referralHoldDays"
              type="number"
              min={0}
              max={90}
              step={1}
              value={form.referralHoldDays}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  referralHoldDays: clamp(e.target.value, 0, 90),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partnerActivationBonus">Бонус за активацию нового партнёра (฿)</Label>
            <Input
              id="partnerActivationBonus"
              type="number"
              min={0}
              step={1}
              value={form.partnerActivationBonus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  partnerActivationBonus: clamp(e.target.value, 0, 1_000_000_000),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mlmLevel1Percent">Доля бонуса — прямое приглашение, %</Label>
            <Input
              id="mlmLevel1Percent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.mlmLevel1Percent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mlmLevel1Percent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mlmLevel2Percent">Доля бонуса — вторая линия, %</Label>
            <Input
              id="mlmLevel2Percent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.mlmLevel2Percent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mlmLevel2Percent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="payoutToInternalRatio">Сколько можно вывести с кошелька, %</Label>
              <FieldHint>
                Остаток бонуса можно тратить только на брони на сайте. Чем ниже процент вывода — тем меньше «ухода»
                денег с платформы и тем сильнее удержание гостей.
              </FieldHint>
            </div>
            <Input
              id="payoutToInternalRatio"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.payoutToInternalRatio}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payoutToInternalRatio: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Экономика сети</CardTitle>
          <CardDescription>
            Учёт эквайринга и операционного резерва при расчёте «сколько можно потратить на бонусы».
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acquiringFeePercent">Комиссия эквайринга, %</Label>
            <Input
              id="acquiringFeePercent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.acquiringFeePercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  acquiringFeePercent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operationalReservePercent">Операционный резерв, %</Label>
            <Input
              id="operationalReservePercent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.operationalReservePercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  operationalReservePercent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className={mlmTotalPercent > 100 ? 'border-red-300' : 'border-emerald-300'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 ${mlmTotalPercent > 100 ? 'text-red-600' : 'text-emerald-600'}`} />
            Лимиты безопасности
          </CardTitle>
          <CardDescription>
            Сохранение не пройдёт, если сумма долей по двум линиям больше 100% или если бонусы съедают всю маржу
            платформы.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-1">
          <p>
            Прямая + вторая линия (в сумме): <strong>{pct(mlmTotalPercent)}</strong>
            {mlmTotalPercent > 100 ? (
              <span className="text-red-600 ml-1">— слишком много, уменьшите доли</span>
            ) : null}
          </p>
          {lastBudget ? (
            <>
              <p>Маржа платформы с брони: <strong>{pct(lastBudget.platformMarginPercent)}</strong></p>
              <p>Фиксированные издержки (эквайринг, резерв, налог): <strong>{pct(lastBudget.fixedCostPercent)}</strong></p>
              <p>Планируемые реферальные выплаты: <strong>{pct(lastBudget.projectedReferralPercent)}</strong></p>
              <p>Всего расходов от маржи: <strong>{pct(lastBudget.projectedTotalBurnPercent)}</strong></p>
            </>
          ) : (
            <p>Цифры появятся после первого успешного сохранения.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Уже выплачено по рефералке</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.totalPaidOutThb || 0).toLocaleString('ru-RU')} ฿
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Баланс маркетингового пула</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.currentPromoTankBalanceThb || 0).toLocaleString('ru-RU')} ฿
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Резерв на 10 активаций партнёров</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.forecastDebitNext10HostActivationsThb || 0).toLocaleString('ru-RU')} ฿
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  );
}

