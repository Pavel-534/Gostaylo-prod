'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState';
import { cn } from '@/lib/utils';
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas';

function partnerLabel(row) {
  const p = row.partner;
  if (!p) return row.partnerId || '—';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return name || p.email || row.partnerId;
}

function payoutMask(row) {
  const ch = row.method?.channel || '';
  const data = row.data || {};
  if (ch === 'BANK') return `счёт …${String(data.accountNumber || '').slice(-4)}`;
  if (ch === 'CRYPTO') return `${String(data.address || '').slice(0, 8)}…`;
  return `карта …${String(data.cardNumber || '').slice(-4)}`;
}

function PayoutVerifyMobileCard({ row, verifyingId, onVerify }) {
  const ch = row.method?.channel || '';
  return (
    <div className="max-sm:border-b max-sm:border-slate-100 max-sm:py-3 sm:hidden">
      <div className="flex items-start gap-2">
        <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{partnerLabel(row)}</p>
          <p className="font-mono text-xs text-slate-500 break-all">{row.partnerId}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <p className="text-slate-400">Метод</p>
          <p className="mt-0.5 font-medium text-slate-800">
            {row.method?.name || '—'} <span className="text-slate-400">({ch})</span>
          </p>
        </div>
        <div>
          <p className="text-slate-400">Создан</p>
          <p className="mt-0.5 font-medium text-slate-800">
            {row.createdAt ? new Date(row.createdAt).toLocaleString('ru-RU') : '—'}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">{payoutMask(row)}</p>
      <Button
        variant="brand"
        className="mt-3 min-h-[44px] w-full"
        disabled={verifyingId === row.id}
        onClick={() => void onVerify(row.id)}
      >
        {verifyingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Верифицировать'}
      </Button>
    </div>
  );
}

export default function AdminPayoutVerificationPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/admin/partner-payout-profiles', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Ошибка загрузки');
        setRows([]);
        return;
      }
      setRows(json.data || []);
    } catch (e) {
      toast.error(e?.message || 'Сеть');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(id) {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/v2/admin/partner-payout-profiles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось верифицировать');
        return;
      }
      toast.success('Профиль верифицирован — допуск в реестр Т-Банка');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Сеть');
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Верификация реквизитов</h1>
          <p className="mt-1 text-sm text-slate-600">
            Профили выплат без верификации не попадают в CSV реестр Т-Банка. После проверки документов нажмите
            «Верифицировать».
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Обновить</span>
        </Button>
      </div>

      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:rounded-2xl sm:border-slate-200')}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            Ожидают верификации
            <Badge variant="secondary" className="ml-2">
              {rows.length}
            </Badge>
          </CardTitle>
          <CardDescription>Таблица `partner_payout_profiles`, `is_verified = false`</CardDescription>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : rows.length === 0 ? (
            <FinTechEmptyState
              icon={ShieldCheck}
              title="Очередь пуста"
              description="Все профили выплат верифицированы. Новые заявки появятся здесь автоматически."
            />
          ) : (
            <>
              <div className="sm:hidden">
                {rows.map((row) => (
                  <PayoutVerifyMobileCard
                    key={row.id}
                    row={row}
                    verifyingId={verifyingId}
                    onVerify={verify}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Партнёр</th>
                      <th className="px-4 py-3 font-medium">Метод</th>
                      <th className="px-4 py-3 font-medium">Маска реквизитов</th>
                      <th className="px-4 py-3 font-medium">Создан</th>
                      <th className="w-40 px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const ch = row.method?.channel || '';
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 shrink-0 text-slate-600" />
                              <div>
                                <div className="font-medium text-slate-900">{partnerLabel(row)}</div>
                                <div className="font-mono text-xs text-slate-500">{row.partnerId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.method?.name || '—'}
                            <span className="ml-1 text-slate-400">({ch})</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{payoutMask(row)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString('ru-RU') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="brand"
                              className="min-h-[44px]"
                              disabled={verifyingId === row.id}
                              onClick={() => void verify(row.id)}
                            >
                              {verifyingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Верифицировать'
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
