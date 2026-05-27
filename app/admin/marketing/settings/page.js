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
        if (!cancelled) toast.error(error?.message || 'Failed to load marketing settings');
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
      toast.success('Marketing safety settings saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save');
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
      toast.success('Marketing Budget (Pool) пополнен');
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
      toast.error(err?.message || 'Top-up failed');
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
      toast.success('Retry выполнен (см. ответ в консоли / data)');
      setRetryBookingId('');
      await refreshTankData();
    } catch (err) {
      toast.error(err?.message || 'Retry failed');
    } finally {
      setRetryBusy(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading marketing safety settings...</div>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to marketing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Marketing safety settings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Stage 72.3 / 91.2: бонус активации партнёра, доли Direct / Sub-Referral, защита маржи.
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            Ваши основные аккаунты (pavel_534 и др.) защищены от автоматической очистки.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marketing Budget (Pool) — виртуальный бюджет</CardTitle>
          <CardDescription>
            SSOT баланса: <code className="text-xs">system_settings.general.marketing_promo_pot</code> + журнал{' '}
            <code className="text-xs">marketing_promo_tank_ledger</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="font-medium text-slate-900">Откуда берутся деньги в пуле</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Organic top-up</strong> — доля от чистой маржи завершённых <em>нереферальных</em> броней (
                <code>organic_to_promo_pot_percent</code>), начисляется в{' '}
                <code>ReferralPnlService.distribute</code>.
              </li>
              <li>
                <strong>Manual top-up</strong> — ручное пополнение админом (кнопка ниже); в леджере{' '}
                <code>manual_topup</code> с <code>metadata.admin_user_id</code> / <code>admin_email</code>.
              </li>
              <li>
                <strong>Welcome return</strong> — истёкший welcome-бонус возвращается в бак (
                <code>welcome_bonus_return</code>, cron).
              </li>
            </ul>
            <p className="text-slate-600">
              <strong>Списания:</strong> Turbo boost (<code>referral_boost_debit</code>), бонус активации партнёра (
              <code>host_activation_bonus_debit</code>), ручной debit (<code>manual_debit</code>).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Текущий баланс (monitor):{' '}
              <strong>{promoPotThb != null ? `${Number(promoPotThb).toLocaleString('ru-RU')} THB` : '—'}</strong>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshTankData()}>
              {tankLogLoading ? '…' : 'Обновить пул / лог'}
            </Button>
          </div>
          <form className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-4" onSubmit={handleManualTopup}>
            <div className="space-y-2">
              <Label htmlFor="manualTopupAmount">Manual top-up (THB)</Label>
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
              <Label htmlFor="manualTopupNote">Комментарий (в metadata)</Label>
              <Input
                id="manualTopupNote"
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Напр. пополнение Q2"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={topupBusy}>
                {topupBusy ? 'Пополнение…' : 'Пополнить Marketing Budget (Pool)'}
              </Button>
            </div>
          </form>
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="font-medium text-slate-900">Retry host activation (после пополнения бака)</p>
            <p className="text-xs text-slate-600">
              Если бронь в <code>metadata.host_activation_promo_tank.status = pending_tank_refill</code>, введите её ID
              и нажмите Retry.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="retryBookingId">booking_id</Label>
                <Input
                  id="retryBookingId"
                  value={retryBookingId}
                  onChange={(e) => setRetryBookingId(e.target.value)}
                  placeholder="b-…"
                />
              </div>
              <Button type="button" variant="secondary" disabled={retryBusy} onClick={handleRetryHostActivation}>
                {retryBusy ? '…' : 'Retry host activation'}
              </Button>
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-900 mb-2">Лог ручных движений бака (кто пополнил)</p>
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
                        Нет записей. Выполните top-up или откройте /admin/marketing/audit.
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
          <CardDescription>Настройки выплат за рекомендации и активацию партнера.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="referralReinvestmentPercent">Referral reinvestment %</Label>
              <FieldHint>
                Ограничивает долю чистой маржи заказа, которую можно направить в реферальный пул. Чем ниже процент,
                тем меньше маркетинг «съедает» прибыль при тех же бронях — движок дополнительно режет выплаты
                safety-lock&apos;ом к валовой марже платформы.
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
            <Label htmlFor="partnerActivationBonus">Partner activation bonus (THB)</Label>
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
            <Label htmlFor="mlmLevel1Percent">Direct Referral Bonus %</Label>
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
            <Label htmlFor="mlmLevel2Percent">Sub-Referral Bonus %</Label>
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
              <Label htmlFor="payoutToInternalRatio">Payout to internal ratio %</Label>
              <FieldHint>
                Доля реферального начисления, которую можно вывести наружу (остальное уходит во внутренние кредиты для
                оплат на платформе). Повышает удержание гостей и снижает cash-out давление на маржу после акций.
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
          <CardDescription>Комиссии и резервы, влияющие на маржу и устойчивость программы.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acquiringFeePercent">Acquiring fee %</Label>
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
            <Label htmlFor="operationalReservePercent">Operational reserve %</Label>
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
            Сохранение заблокировано, если сумма Direct + Sub-Referral выше 100% или если выплаты и издержки
            превышают доступную маржу платформы.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-1">
          <p>
            Direct + Sub (итого): <strong>{pct(mlmTotalPercent)}</strong>
          </p>
          {lastBudget ? (
            <>
              <p>Platform margin: <strong>{pct(lastBudget.platformMarginPercent)}</strong></p>
              <p>Fixed costs: <strong>{pct(lastBudget.fixedCostPercent)}</strong></p>
              <p>Projected referral payouts: <strong>{pct(lastBudget.projectedReferralPercent)}</strong></p>
              <p>Projected total burn: <strong>{pct(lastBudget.projectedTotalBurnPercent)}</strong></p>
            </>
          ) : (
            <p>Budget snapshot will appear after first successful save.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Total paid out</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.totalPaidOutThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Marketing Budget (Pool)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.currentPromoTankBalanceThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Forecast debits</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.forecastDebitNext10HostActivationsThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  );
}

