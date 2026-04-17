'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Landmark, PiggyBank, Wallet, Building2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function fmtThb(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPayoutAmount(p) {
  const x = Number(p?.finalAmount ?? p?.amount);
  if (!Number.isFinite(x)) return '—';
  const c = String(p?.currency || 'THB').toUpperCase();
  if (c === 'THB') return fmtThb(x);
  return `${x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
}

export default function AdminFinancialHealthPage() {
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const [processingPayouts, setProcessingPayouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [payoutActionId, setPayoutActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, reconRes, procRes] = await Promise.all([
        fetch('/api/v2/admin/ledger-balances', { credentials: 'include' }),
        fetch('/api/v2/admin/ledger-reconciliation', { credentials: 'include' }),
        fetch('/api/v2/admin/payouts?status=PROCESSING&limit=100', { credentials: 'include' }),
      ]);
      const balJson = await balRes.json().catch(() => ({}));
      const reconJson = await reconRes.json().catch(() => ({}));
      const procJson = await procRes.json().catch(() => ({}));

      if (!balRes.ok || !balJson.success) {
        setData(null);
        setError(balJson.error || `Ошибка балансов ${balRes.status}`);
        return;
      }
      setData(balJson.data);
      if (reconRes.ok && reconJson.success) {
        setRecon(reconJson.data);
      } else {
        setRecon(null);
      }
      if (procRes.ok && procJson.success && Array.isArray(procJson.data)) {
        setProcessingPayouts(procJson.data);
      } else {
        setProcessingPayouts([]);
      }
    } catch (e) {
      setData(null);
      setError(e?.message || 'Сеть');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sys = data?.system;
  const lr = data?.ledgerReporting;
  const potThb = lr?.roundingPotLedgerThb ?? sys?.processingPotRoundingThb;
  const fundThb = lr?.insuranceFundLedgerThb ?? sys?.insuranceFundReserveThb;

  async function handleTbankRegistry() {
    setRegistryLoading(true);
    try {
      const res = await fetch('/api/v2/admin/payouts/tbank-registry', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encoding: 'utf-8' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось сформировать реестр');
        return;
      }
      const d = json.data || {};
      const { filename, exportedCount, skippedUnverified, csv, csvBase64, encoding } = d;
      const skipped = Array.isArray(skippedUnverified) ? skippedUnverified.length : 0;
      if (!exportedCount) {
        toast.message('Нет выплат для выгрузки (PENDING, RU bank, верифицированный профиль).');
      } else {
        toast.success(`В реестр включено выплат: ${exportedCount}. Пропущено: ${skipped}.`);
      }
      if (skipped > 0) {
        toast.info('Пропуски: неверифицированный профиль, неполные реквизиты или не тот метод.');
      }
      if (encoding === 'windows-1251' && csvBase64 && filename) {
        const bin = Uint8Array.from(atob(csvBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bin], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (csv && filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      toast.error(e?.message || 'Ошибка сети');
    } finally {
      setRegistryLoading(false);
    }
  }

  async function markPayoutStatus(payoutId, status) {
    setPayoutActionId(payoutId);
    try {
      const res = await fetch(`/api/v2/admin/payouts/${encodeURIComponent(payoutId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось обновить выплату');
        return;
      }
      toast.success(status === 'PAID' ? 'Выплата отмечена как PAID (проводка в ledger).' : 'Выплата отмечена как FAILED.');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Сеть');
    } finally {
      setPayoutActionId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Финансовое здоровье (Ledger)</h1>
          <p className="text-slate-600 text-sm mt-1">
            Остатки по счетам из проводок double-entry после зачисления оплат (PAID_ESCROW).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Обновить</span>
          </Button>
          <Button
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => void handleTbankRegistry()}
            disabled={registryLoading}
            data-testid="tbank-registry-export"
          >
            {registryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-2">Сформировать реестр для Т-Банка</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
      )}

      {!loading && processingPayouts.length > 0 && (
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Выплаты в обработке (PROCESSING)</CardTitle>
            <CardDescription>
              После выгрузки реестра Т-Банка отметьте факт банка: <strong>PAID</strong> (с проводкой в ledger) или{' '}
              <strong>FAILED</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-100 -mx-1">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Партнёр</th>
                    <th className="px-3 py-2 font-medium text-right">Сумма</th>
                    <th className="px-3 py-2 font-medium">Метод</th>
                    <th className="px-3 py-2 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processingPayouts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.id}</td>
                      <td className="px-3 py-2 text-slate-700">{p.partnerId}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPayoutAmount(p)}</td>
                      <td className="px-3 py-2 text-slate-600">{p.payoutMethod?.name || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={!!payoutActionId}
                            onClick={() => void markPayoutStatus(p.id, 'PAID')}
                          >
                            {payoutActionId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'PAID'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!!payoutActionId}
                            onClick={() => void markPayoutStatus(p.id, 'FAILED')}
                          >
                            FAILED
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка…
        </div>
      ) : null}

      {sys ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 p-8 text-white shadow-xl ring-1 ring-white/20">
            <PiggyBank className="absolute -right-2 -top-2 h-36 w-36 opacity-15" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Копилка на платежки</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">Rounding Pot</h2>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Накопления по ledger{' '}
              <span className="font-mono">
                {lr?.aliases?.FEE_CLEARING?.ledgerAccountCode || 'PROCESSING_POT_ROUNDING'}
              </span>{' '}
              (операционный алиас <span className="font-mono">FEE_CLEARING</span>).
            </p>
            <p className="mt-6 text-4xl font-black tabular-nums tracking-tight drop-shadow-sm" data-testid="hero-pot">
              {fmtThb(potThb)}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-800 via-teal-700 to-emerald-600 p-8 text-white shadow-xl ring-1 ring-white/20">
            <Landmark className="absolute -right-2 -top-2 h-36 w-36 opacity-15" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Страховой фонд</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">Insurance Fund</h2>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Накопления по ledger{' '}
              <span className="font-mono">
                {lr?.aliases?.RESERVES?.ledgerAccountCode || 'INSURANCE_FUND_RESERVE'}
              </span>{' '}
              (операционный алиас <span className="font-mono">RESERVES</span>).
            </p>
            <p className="mt-6 text-4xl font-black tabular-nums tracking-tight drop-shadow-sm" data-testid="hero-fund">
              {fmtThb(fundThb)}
            </p>
          </div>
        </div>
      ) : null}

      {recon && (
        <Card
          className={`rounded-2xl border shadow-sm ${
            recon.marginLeakage ? 'border-amber-300 bg-amber-50/80' : 'border-slate-200'
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {recon.marginLeakage ? (
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              ) : (
                <Wallet className="h-5 w-5 text-slate-600" />
              )}
              Сверка Cash (MVP)
            </CardTitle>
            <CardDescription>
              {recon.cashAccountLabel}. Сравнение суммы DEBIT по clearing и суммы CREDIT по распределению; журналы с
              дисбалансом: {recon.unbalancedJournals ?? 0}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Вход (DEBIT clearing): <strong>{fmtThb(recon.guestClearingDebitsThb)}</strong>
              </span>
              <span>
                Распределение (CREDIT): <strong>{fmtThb(recon.distributionCreditsThb)}</strong>
              </span>
              <span>
                Дельта: <strong>{fmtThb(recon.deltaThb)}</strong>
              </span>
            </div>
            {recon.marginLeakage ? (
              <p className="text-amber-900 font-medium">
                Margin Leakage: обнаружено расхождение или не сходятся проводки по журналу. Проверьте ledger и
                импорты.
              </p>
            ) : (
              <p className="text-emerald-800">Расхождений не найдено (в пределах 0,02 THB).</p>
            )}
          </CardContent>
        </Card>
      )}

      {sys ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-slate-700" />
                Комиссия платформы (нетто)
              </CardTitle>
              <CardDescription>PLATFORM_FEE — маржа за вычетом страхового резерва</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{fmtThb(sys.platformFeeThb)}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-700" />
                К оплате партнёрам (сумма)
              </CardTitle>
              <CardDescription>Все счета PARTNER_EARNINGS по проводкам</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{fmtThb(data.partnerEarningsTotalThb)}</p>
              <p className="text-xs text-slate-500 mt-2">Счетов партнёров: {data.partnerAccountCount}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Guest clearing (контроль)</CardTitle>
              <CardDescription>
                Ожидаемо совпадает с суммой зачислений; соглашение: баланс = CREDIT − DEBIT по счёту
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{fmtThb(sys.guestPaymentClearingThb)}</p>
              <p className="text-xs text-slate-500 mt-2">{data.convention}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
