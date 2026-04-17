'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

function partnerLabel(row) {
  const p = row.partner;
  if (!p) return row.partnerId || '—';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return name || p.email || row.partnerId;
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Верификация реквизитов</h1>
          <p className="text-slate-600 text-sm mt-1">
            Профили выплат без верификации не попадают в CSV реестр Т-Банка. После проверки документов нажмите
            «Верифицировать».
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Обновить</span>
        </Button>
      </div>

      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            Ожидают верификации
            <Badge variant="secondary" className="ml-2">
              {rows.length}
            </Badge>
          </CardTitle>
          <CardDescription>Таблица `partner_payout_profiles`, `is_verified = false`</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">Нет неверифицированных профилей.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Партнёр</th>
                    <th className="px-4 py-3 font-medium">Метод</th>
                    <th className="px-4 py-3 font-medium">Маска реквизитов</th>
                    <th className="px-4 py-3 font-medium">Создан</th>
                    <th className="px-4 py-3 font-medium w-40" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const ch = row.method?.channel || '';
                    const data = row.data || {};
                    const mask =
                      ch === 'BANK'
                        ? `счёт …${String(data.accountNumber || '').slice(-4)}`
                        : ch === 'CRYPTO'
                          ? `${String(data.address || '').slice(0, 8)}…`
                          : `карта …${String(data.cardNumber || '').slice(-4)}`;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-medium text-slate-900">{partnerLabel(row)}</div>
                              <div className="text-xs text-slate-500 font-mono">{row.partnerId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.method?.name || '—'}
                          <span className="text-slate-400 ml-1">({ch})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{mask}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString('ru-RU') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
