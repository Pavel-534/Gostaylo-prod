'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Landmark, PiggyBank, Wallet, Building2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function AdminFinancialHealthPage() {
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, reconRes] = await Promise.all([
        fetch('/api/v2/admin/ledger-balances', { credentials: 'include' }),
        fetch('/api/v2/admin/ledger-reconciliation', { credentials: 'include' }),
      ]);
      const balJson = await balRes.json().catch(() => ({}));
      const reconJson = await reconRes.json().catch(() => ({}));

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

  function fmtThb(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
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
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/marketing/referral-payouts?tab=registry">
              <ExternalLink className="h-4 w-4" />
              <span className="ml-2">Referral Payout Ops →</span>
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-800 via-brand-hover to-emerald-600 p-8 text-white shadow-xl ring-1 ring-white/20">
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
              Сверка Cash (MVP) — только Booking Capture
            </CardTitle>
            <CardDescription>
              {recon.cashAccountLabel}. DEBIT clearing и CREDIT распределения считаются только в журналах захвата
              оплаты; <span className="font-mono">PARTNER_PAYOUTS_SETTLED</span> не входит в распределение. Журналов с
              дисбалансом DR/CR: {recon.unbalancedJournals ?? 0}.
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
            {recon.payoutSelfCheck ? (
              <div
                className={`mt-3 rounded-lg border p-3 text-xs ${
                  recon.payoutSelfCheck.equalsLedgerWithinTolerance
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                    : 'border-red-300 bg-red-50 text-red-950'
                }`}
              >
                <p className="font-semibold text-sm mb-1">Smoke: открытые выплаты vs PARTNER_EARNINGS (ledger)</p>
                <p>
                  Σ gross (PENDING+PROCESSING): <strong>{fmtThb(recon.payoutSelfCheck.openPipelineGrossThb)}</strong> ·
                  Нетто PARTNER_EARNINGS:{' '}
                  <strong>{fmtThb(recon.payoutSelfCheck.partnerEarningsLedgerNetThb)}</strong> · Дельта:{' '}
                  <strong
                    className={
                      recon.payoutSelfCheck.equalsLedgerWithinTolerance ? '' : 'text-red-600 text-base tabular-nums'
                    }
                  >
                    {fmtThb(recon.payoutSelfCheck.deltaOpenVsLedgerThb)}
                  </strong>
                </p>
                <p
                  className={`mt-2 leading-relaxed ${
                    recon.payoutSelfCheck.equalsLedgerWithinTolerance ? 'text-slate-600' : 'text-red-800 font-medium'
                  }`}
                >
                  {recon.payoutSelfCheck.note}
                </p>
              </div>
            ) : null}
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
