'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Flag, RefreshCw, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_OPTIONS = ['open', 'approved', 'blocked', 'flagged', 'all'];

function formatResolveSummary(action, data) {
  const approved = Array.isArray(data?.approvedRows) ? data.approvedRows.length : 0;
  const rejected = Array.isArray(data?.rejectedRows) ? data.rejectedRows.length : 0;
  const credited = Number(data?.creditedAmountThb ?? 0);
  const payoutBlockedCleared = data?.payoutBlockedCleared;

  if (action === 'approved') {
    return {
      title: 'Одобрено — начисление разблокировано',
      lines: [
        `Строк ledger: ${approved}`,
        credited > 0 ? `Зачислено на кошелёк: ${credited.toLocaleString('ru-RU')} THB` : 'Зачисление на кошелёк: без изменений',
        payoutBlockedCleared === true
          ? 'referral_payout_blocked: снят'
          : payoutBlockedCleared === false
            ? 'referral_payout_blocked: остаётся (есть другие проверки)'
            : 'referral_payout_blocked: без изменений',
      ],
    };
  }
  if (action === 'blocked') {
    return {
      title: 'Заблокировано',
      lines: [`Строк ledger отклонено: ${rejected}`, 'referral_payout_blocked: установлен'],
    };
  }
  return {
    title: `Статус: ${action}`,
    lines: ['Изменён только статус очереди (без ledger side-effects).'],
  };
}

export default function ReferralFraudQueuePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('open');
  const [resolveDialog, setResolveDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status, limit: '200' });
      const res = await fetch(`/api/v2/admin/referral/fraud-queue?${q}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'FRAUD_QUEUE_LOAD_FAILED');
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить очередь');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id, action) {
    try {
      const res = await fetch(`/api/v2/admin/referral/fraud-queue/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'FRAUD_QUEUE_ACTION_FAILED');

      const summary = formatResolveSummary(action, json.data || {});
      setResolveDialog({ action, id, ...summary });
      toast.success(summary.title);
      await load();
    } catch (error) {
      toast.error(error?.message || 'Не удалось изменить статус');
    }
  }

  return (
    <div className="mx-auto max-w-[1260px] space-y-6 p-4 md:p-6">
      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{resolveDialog?.title || 'Результат проверки'}</DialogTitle>
            <DialogDescription>Stage 131.8 — ledger, кошелёк и payout block синхронизированы.</DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            {(resolveDialog?.lines || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResolveDialog(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Fraud Queue</h1>
          <p className="mt-1 text-sm text-slate-600">Ручное ревью подозрительных track/convert/register сигналов.</p>
        </div>
        <Button type="button" variant="brand" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm">
          <Label>Статус</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Очередь</CardTitle>
          <CardDescription>{rows.length} записей</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Когда</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Код / referrer</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Deep-links</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(row.created_at).toLocaleString('ru-RU')}</TableCell>
                  <TableCell className="font-mono text-xs">{row.source}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={row.severity === 'block' ? 'border-rose-300 text-rose-900' : 'border-amber-300 text-amber-900'}>
                      {row.severity}
                    </Badge>
                    <Badge className="ml-1" variant="secondary">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p className="font-mono">{row.referral_code || '—'}</p>
                    <p className="text-slate-500">{row.referrer_id || row.candidate_email || '—'}</p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 max-w-[340px]">
                    <p>{row.reason || '—'}</p>
                    {Array.isArray(row.rule_codes) && row.rule_codes.length ? (
                      <p className="mt-1 text-slate-500">{row.rule_codes.join(', ')}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/marketing/attribution?referrerId=${encodeURIComponent(String(row.referrer_id || ''))}`}
                        className="text-brand hover:underline"
                      >
                        attribution
                      </Link>
                      {row?.metadata?.ledger_id ? (
                        <Link
                          href={`/admin/marketing/attribution?ledgerId=${encodeURIComponent(String(row.metadata.ledger_id))}`}
                          className="text-brand hover:underline"
                        >
                          ledger
                        </Link>
                      ) : (
                        <span className="text-slate-400">ledger</span>
                      )}
                      {row.candidate_user_id || row.referrer_id ? (
                        <Link
                          href={`/admin/users/${encodeURIComponent(String(row.candidate_user_id || row.referrer_id))}`}
                          className="text-brand hover:underline"
                        >
                          profile
                        </Link>
                      ) : (
                        <span className="text-slate-400">profile</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => void review(row.id, 'approved')}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void review(row.id, 'blocked')}>
                      <ShieldX className="h-4 w-4 text-rose-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void review(row.id, 'flagged')}>
                      <Flag className="h-4 w-4 text-amber-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && !loading ? <p className="py-6 text-sm text-slate-500">Очередь пуста.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
