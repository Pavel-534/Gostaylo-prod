'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { formatAdminUserLabel } from '@/lib/admin/format-admin-user-label';
import { fmtAdminPayoutAmount } from '@/lib/admin/format-payout-display';
import {
  bulkReferralPayoutAction,
  downloadRegistryPayload,
  exportTbankRegistry,
  fetchAdminPayouts,
  fetchPayoutQueue,
  fetchRegistryPreview,
  markPayoutStatus,
  patchWalletPayout,
  skippedReasonLabel,
} from '@/lib/admin/referral-payout-ops-client';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { AdminStatusPill } from '@/components/admin/AdminStatusPill';
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState';

const TAB_KEYS = ['queue', 'registry', 'processing'];

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function userLabel(row) {
  const profile = row?.profile
    ? {
        first_name: row.profile.firstName ?? row.profile.first_name,
        last_name: row.profile.lastName ?? row.profile.last_name,
        email: row.profile.email,
      }
    : null;
  return formatAdminUserLabel(profile, row?.userId);
}

function QueueTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [minPayoutThb, setMinPayoutThb] = useState(1000);
  const [readyCount, setReadyCount] = useState(0);
  const [readyWithdrawableTotalThb, setReadyWithdrawableTotalThb] = useState(0);
  const [togglingId, setTogglingId] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const loadPayouts = useCallback(async (opts = {}) => {
    const nextReadyOnly = opts.readyOnly ?? readyOnly;
    const nextQuery = opts.query ?? query;
    setLoading(true);
    try {
      const data = await fetchPayoutQueue({
        readyOnly: nextReadyOnly,
        referralOnly: true,
        query: nextQuery,
      });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMinPayoutThb(Number(data.minPayoutThb || 1000));
      setReadyCount(Number(data.readyCount || 0));
      setReadyWithdrawableTotalThb(Number(data.readyBalanceTotalThb || 0));
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error?.message || 'Failed to load payout queue');
    } finally {
      setLoading(false);
    }
  }, [query, readyOnly]);

  useEffect(() => {
    void loadPayouts({ readyOnly: true, query: '' });
  }, [loadPayouts]);

  async function clearReferralRequest(row) {
    const uid = String(row?.userId || '').trim();
    if (!uid) return;
    setTogglingId(uid);
    try {
      await patchWalletPayout({ userId: uid, clearReferralWithdrawal: true });
      toast.success('Referral withdrawal request cleared');
      await loadPayouts();
    } catch (error) {
      toast.error(error?.message || 'Failed to clear referral request');
    } finally {
      setTogglingId('');
    }
  }

  function toggleSelect(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function bulkReferral(action, adminComment = '') {
    const userIds = [...selectedIds];
    if (!userIds.length) return;
    setBulkBusy(true);
    try {
      const data = await bulkReferralPayoutAction(action, userIds, { adminComment });
      toast.success(`${action}: ${data.processed ?? 0} wallet(s)`);
      await loadPayouts();
    } catch (error) {
      toast.error(error?.message || 'Bulk action failed');
    } finally {
      setBulkBusy(false);
      setShowRejectDialog(false);
      setRejectComment('');
    }
  }

  function openRejectDialog() {
    if (selectedIds.size === 0) return;
    setRejectComment('');
    setShowRejectDialog(true);
  }

  async function confirmReject() {
    const comment = String(rejectComment || '').trim();
    if (comment.length < 3) {
      toast.error('Укажите причину отклонения (минимум 3 символа)');
      return;
    }
    await bulkReferral('reject', comment);
  }

  async function toggleVerify(row) {
    const uid = String(row?.userId || '').trim();
    if (!uid) return;
    setTogglingId(uid);
    try {
      await patchWalletPayout({
        userId: uid,
        verifiedForPayout: !(row?.verifiedForPayout === true),
      });
      toast.success('Payout verification flag updated');
      await loadPayouts();
    } catch (error) {
      toast.error(error?.message || 'Failed to update payout flag');
    } finally {
      setTogglingId('');
    }
  }

  const blockersMap = useMemo(() => {
    return {
      BELOW_MIN_PAYOUT: `Balance below min threshold (${formatThb(minPayoutThb)} THB)`,
      PROFILE_NOT_VERIFIED: 'Profile is not verified',
      WALLET_NOT_CLEARED_FOR_PAYOUT: 'Доступен вывод: нет (нужен допуск админа)',
    };
  }, [minPayoutThb]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Min payout threshold</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatThb(minPayoutThb)} THB</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Ready in queue</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{readyCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Withdrawable total</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatThb(readyWithdrawableTotalThb)} THB</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Заявки withdrawable_referral и кандидаты на approve/reject.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="payout-query">Search</Label>
            <Input
              id="payout-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="email / name / user id"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="ready-only"
              type="checkbox"
              checked={readyOnly}
              onChange={(e) => setReadyOnly(e.target.checked)}
            />
            <Label htmlFor="ready-only">Ready only</Label>
          </div>
          <Button onClick={() => void loadPayouts({ readyOnly, query })}>Apply</Button>
          <Button variant="outline" onClick={() => void loadPayouts()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void bulkReferral('approve')}>
            Approve selected ({selectedIds.size})
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={bulkBusy || selectedIds.size === 0}
            onClick={openRejectDialog}
          >
            Reject selected
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(rows.map((r) => r.userId)))}>
            Select all
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Очередь</CardTitle>
          <CardDescription>Bulk approve/reject для withdrawable_referral.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500 py-10 text-center">Loading...</p>
          ) : rows.length === 0 ? (
            <FinTechEmptyState
              icon={Wallet}
              title="Нет заявок в очереди"
              description="Амбассадоры с withdrawable_referral появятся здесь после заявки в кошельке."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Withdrawable</TableHead>
                  <TableHead className="text-right">Internal</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Payout flag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.userId)}
                        onChange={() => toggleSelect(row.userId)}
                        aria-label={`Select ${row.userId}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{userLabel(row)}</div>
                      <div className="text-xs text-slate-500 font-mono break-all">{row.userId}</div>
                    </TableCell>
                    <AdminTableAmount as="td" value={row.withdrawableBalanceThb} showPlus={false} />
                    <AdminTableAmount as="td" value={row.internalCreditsThb} showPlus={false} className="text-slate-700" />
                    <TableCell>
                      {row.profileVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                          <ShieldCheck className="h-4 w-4" /> verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                          <ShieldOff className="h-4 w-4" /> pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.verifiedForPayout ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                          <CheckCircle2 className="h-4 w-4" /> Доступен вывод
                        </span>
                      ) : (
                        <span className="text-rose-700 text-xs">Доступен вывод: нет</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.readyForPayout ? (
                        <AdminStatusPill status="READY" />
                      ) : (
                        <div className="space-y-1">
                          {(row.blockers || []).map((blocker) => (
                            <div key={blocker} className="text-amber-700">
                              {blockersMap[blocker] || blocker}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.referralWithdrawalStatus === 'withdrawable_referral' ? (
                        <span className="text-violet-700 font-medium">
                          withdrawable_referral
                          {row.referralWithdrawalAmountThb
                            ? ` · ${formatThb(row.referralWithdrawalAmountThb)} THB`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {row.referralWithdrawalStatus === 'withdrawable_referral' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={togglingId === row.userId}
                          onClick={() => void clearReferralRequest(row)}
                        >
                          Clear referral
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant={row.verifiedForPayout ? 'outline' : 'default'}
                        disabled={togglingId === row.userId}
                        onClick={() => void toggleVerify(row)}
                      >
                        {togglingId === row.userId
                          ? '...'
                          : row.verifiedForPayout
                            ? 'Отключить вывод'
                            : 'Открыть вывод'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить заявки на вывод</AlertDialogTitle>
            <AlertDialogDescription>
              Укажите причину отклонения для {selectedIds.size} выбранных заявок. Текст будет виден амбассадору.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reject-comment">Причина отклонения</Label>
            <Textarea
              id="reject-comment"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Например: неверные реквизиты карты"
              className="mt-2 min-h-[88px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Отмена</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={bulkBusy} onClick={() => void confirmReject()}>
              {bulkBusy ? 'Отклонение…' : 'Отклонить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RegistryTab() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const [skipped, setSkipped] = useState([]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRegistryPreview({ referralOnly: true });
      setPreview(Array.isArray(data.preview) ? data.preview : []);
      setSkipped(Array.isArray(data.skippedUnverified) ? data.skippedUnverified : []);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить превью реестра');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportTbankRegistry({ encoding: 'utf-8', referralOnly: true });
      const exportedCount = Number(data.exportedCount || 0);
      const skippedCount = Array.isArray(data.skippedUnverified) ? data.skippedUnverified.length : 0;
      if (!exportedCount) {
        toast.message('Нет referral-выплат для выгрузки (PENDING, RU bank, REFERRAL_RUB_CARD).');
      } else {
        toast.success(`В реестр включено: ${exportedCount}. Пропущено: ${skippedCount}.`);
      }
      if (skippedCount > 0) {
        toast.info('Пропуски: неверифицированный профиль, неполные реквизиты или не referral rail.');
      }
      downloadRegistryPayload(data);
      await loadPreview();
    } catch (e) {
      toast.error(e?.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }

  const totalRub = preview.reduce((s, r) => s + Number(r.amountRub || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            PENDING referral payouts · rail <code className="text-xs">REFERRAL_RUB_CARD</code> · метод RU bank.
          </p>
          <p className="text-lg font-semibold mt-1 tabular-nums">
            {preview.length} строк · Σ {totalRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} RUB
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadPreview()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => void handleExport()}
            disabled={exporting}
            data-testid="tbank-registry-export"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-2">Экспорт CSV → PROCESSING</span>
          </Button>
        </div>
      </div>

      {skipped.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">Пропущено ({skipped.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-900 space-y-1 max-h-40 overflow-y-auto">
            {skipped.map((s, i) => (
              <div key={`${s.payoutId}-${i}`}>
                <span className="font-mono">{s.payoutId || s.partnerId || '—'}</span>
                {' · '}
                {skippedReasonLabel(s.reason)}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Превью реестра Т-Банка</CardTitle>
          <CardDescription>ФИО; счёт; БИК; ИНН; назначение; сумма RUB</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Загрузка…</p>
          ) : preview.length === 0 ? (
            <FinTechEmptyState
              icon={FileSpreadsheet}
              title="Нет строк для реестра"
              description="После approve в очереди и создания payout PENDING строки появятся здесь."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout ID</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Rail</TableHead>
                  <TableHead className="text-right">RUB</TableHead>
                  <TableHead>Назначение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row) => (
                  <TableRow key={row.payoutId}>
                    <TableCell className="font-mono text-xs">{row.payoutId}</TableCell>
                    <TableCell>{row.recipientName}</TableCell>
                    <TableCell className="text-xs font-mono">{row.payoutRail || 'REFERRAL_RUB_CARD'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.amountRub}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[240px] truncate">{row.purpose}</TableCell>
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

function ProcessingTab() {
  const [statusFilter, setStatusFilter] = useState('PROCESSING');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [payoutActionId, setPayoutActionId] = useState(null);
  const [payoutConfirm, setPayoutConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPayouts(statusFilter);
      setRows(data);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить выплаты');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmMarkStatus() {
    if (!payoutConfirm) return;
    setPayoutActionId(payoutConfirm.payoutId);
    try {
      await markPayoutStatus(payoutConfirm.payoutId, payoutConfirm.status, payoutConfirm.note);
      toast.success(
        payoutConfirm.status === 'PAID'
          ? 'Выплата отмечена как PAID (проводка в ledger).'
          : 'Выплата отмечена как FAILED.',
      );
      setPayoutConfirm(null);
      await load();
    } catch (e) {
      toast.error(e?.message || 'Не удалось обновить выплату');
    } finally {
      setPayoutActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={payoutConfirm !== null} onOpenChange={(open) => !open && setPayoutConfirm(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {payoutConfirm?.status === 'PAID' ? 'Подтвердить PAID' : 'Подтвердить FAILED'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {payoutConfirm?.status === 'PAID'
                ? 'В ledger будет проведена запись списания. Отменить автоматически нельзя — проверьте банк.'
                : 'Выплата будет помечена как ошибка банка.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Комментарий (опционально)</label>
            <Textarea
              value={payoutConfirm?.note ?? ''}
              onChange={(e) => setPayoutConfirm((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
              rows={3}
              className="resize-none min-h-0"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!payoutActionId}>Отмена</AlertDialogCancel>
            <Button
              variant={payoutConfirm?.status === 'FAILED' ? 'destructive' : 'default'}
              className={payoutConfirm?.status === 'PAID' ? 'bg-emerald-700 hover:bg-emerald-800' : ''}
              disabled={!!payoutActionId || !payoutConfirm}
              onClick={() => void confirmMarkStatus()}
            >
              Подтвердить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center gap-2">
        {['PROCESSING', 'PAID', 'FAILED'].map((st) => (
          <Button
            key={st}
            size="sm"
            variant={statusFilter === st ? 'default' : 'outline'}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral payouts — {statusFilter}</CardTitle>
          <CardDescription>
            Только REFERRAL_RUB_CARD / referral_withdrawal. После реестра — отметьте PAID или FAILED.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Загрузка…</p>
          ) : rows.length === 0 ? (
            <FinTechEmptyState
              icon={Wallet}
              title={`Нет выплат со статусом ${statusFilter}`}
              description="Экспортируйте реестр или дождитесь обработки банком."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">THB / payout</TableHead>
                  <TableHead>Rail</TableHead>
                  <TableHead>Метод</TableHead>
                  <TableHead>Дата</TableHead>
                  {statusFilter === 'PROCESSING' ? <TableHead>Действия</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="text-xs">{p.partnerId}</TableCell>
                    <TableCell className="text-right">
                      <AdminTableAmount value={p.grossAmount ?? p.finalAmount ?? p.amount} showPlus={false} />
                      {p.amountInPayoutCurrency != null ? (
                        <div className="text-xs text-slate-500">{fmtAdminPayoutAmount(p)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{p.payoutRail || '—'}</TableCell>
                    <TableCell className="text-xs">{p.payoutMethod?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString('ru-RU') : '—'}
                    </TableCell>
                    {statusFilter === 'PROCESSING' ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={!!payoutActionId}
                            onClick={() => setPayoutConfirm({ payoutId: p.id, status: 'PAID', note: '' })}
                          >
                            PAID
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!!payoutActionId}
                            onClick={() => setPayoutConfirm({ payoutId: p.id, status: 'FAILED', note: '' })}
                          >
                            FAILED
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
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

export function ReferralPayoutOpsDesk() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = String(searchParams.get('tab') || 'queue').toLowerCase();
  const activeTab = TAB_KEYS.includes(tabParam) ? tabParam : 'queue';

  function setTab(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/admin/marketing/referral-payouts?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing/budget">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Бюджет и выплаты
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Referral Payout Ops</h1>
          <p className="text-sm text-slate-600 mt-1">
            Единый пульт: очередь заявок, реестр Т-Банка, статусы PROCESSING / PAID / FAILED.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="queue">Очередь</TabsTrigger>
          <TabsTrigger value="registry">Реестр Т-Банка</TabsTrigger>
          <TabsTrigger value="processing">В обработке</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-6">
          <QueueTab />
        </TabsContent>
        <TabsContent value="registry" className="mt-6">
          <RegistryTab />
        </TabsContent>
        <TabsContent value="processing" className="mt-6">
          <ProcessingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReferralPayoutOpsDesk;
