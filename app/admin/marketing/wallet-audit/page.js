'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function formatDateTime(value) {
  const d = new Date(value || '');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU');
}

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function WalletAuditPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [limit, setLimit] = useState(80);
  const [userIdFilter, setUserIdFilter] = useState('');

  async function loadLedger(nextLimit = limit, uid = userIdFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(Math.min(200, Math.max(1, Number(nextLimit) || 80))));
      const u = String(uid || '').trim();
      if (u) params.set('userId', u);
      const res = await fetch(`/api/v2/admin/wallet/transactions?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'LOAD_FAILED');
      const rows = json?.data?.transactions;
      setTransactions(Array.isArray(rows) ? rows : []);
      if (json?.data?.limit) setLimit(json.data.limit);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить операции кошельков');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLedger(80, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creditsDebits = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const row of transactions) {
      const op = String(row?.operation_type || '').toLowerCase();
      const amount = Number(row?.amount_thb) || 0;
      if (op === 'credit') credits += amount;
      if (op === 'debit') debits += amount;
    }
    return { credits, debits };
  }, [transactions]);

  function downloadCsv() {
    const headers = [
      'created_at',
      'user_id',
      'email',
      'operation_type',
      'amount_thb',
      'tx_type',
      'reference_id',
      'expires_at',
      'balance_after_thb',
    ];
    const lines = [headers.join(',')];
    for (const row of transactions) {
      const email = row?.profile?.email ?? '';
      lines.push(
        [
          escapeCsvCell(row.created_at),
          escapeCsvCell(row.user_id),
          escapeCsvCell(email),
          escapeCsvCell(row.operation_type),
          escapeCsvCell(row.amount_thb),
          escapeCsvCell(row.tx_type),
          escapeCsvCell(row.reference_id),
          escapeCsvCell(row.expires_at),
          escapeCsvCell(row.balance_after_thb),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Маркетинг
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Wallet audit trail</h1>
          <p className="text-sm text-gray-600 mt-1">
            История операций по всем кошелькам: начисления welcome/referral и списания на чекауте.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadLedger()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={loading || !transactions.length}>
            CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
          <CardDescription>
            По умолчанию последние {limit} записей. Укажите User ID для узкого поиска.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="wallet-user-filter">User ID</Label>
            <Input
              id="wallet-user-filter"
              placeholder="user-xxxxx…"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={() => void loadLedger(limit, userIdFilter)} disabled={loading}>
            Применить
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Строк в выборке</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{transactions.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Σ credit (выборка)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatAmount(creditsDebits.credits)} THB
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Σ debit (выборка)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatAmount(creditsDebits.debits)} THB
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Журнал</CardTitle>
          <CardDescription>
            Полный след для сверки SSOT: кто потратил бонусы на оплату и когда пришли начисления.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Загрузка…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет записей.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Баланс после</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      <div className="text-xs font-mono break-all">{row.user_id}</div>
                      {row.profile?.email ? (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {row.profile.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="uppercase text-xs">{row.operation_type}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatAmount(row.amount_thb)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[140px] break-words">{row.tx_type}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[180px] break-all">
                      {row.reference_id || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatAmount(row.balance_after_thb)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
