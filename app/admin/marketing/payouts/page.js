'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function userLabel(row) {
  const first = row?.profile?.firstName || '';
  const last = row?.profile?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || row?.profile?.email || row?.userId || 'Unknown user';
}

export default function MarketingPayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [referralOnly, setReferralOnly] = useState(false);
  const [minPayoutThb, setMinPayoutThb] = useState(1000);
  const [readyCount, setReadyCount] = useState(0);
  const [readyWithdrawableTotalThb, setReadyWithdrawableTotalThb] = useState(0);
  const [togglingId, setTogglingId] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function loadPayouts(opts = {}) {
    const nextReadyOnly = opts.readyOnly ?? readyOnly;
    const nextReferralOnly = opts.referralOnly ?? referralOnly;
    const nextQuery = opts.query ?? query;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '250');
      params.set('readyOnly', nextReadyOnly ? '1' : '0');
      if (nextReferralOnly) params.set('referralOnly', '1');
      if (String(nextQuery || '').trim()) params.set('query', String(nextQuery).trim());
      const res = await fetch(`/api/v2/admin/wallet/payouts?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'LOAD_PAYOUTS_FAILED');
      const data = json.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMinPayoutThb(Number(data.minPayoutThb || 1000));
      setReadyCount(Number(data.readyCount || 0));
      setReadyWithdrawableTotalThb(Number(data.readyBalanceTotalThb || 0));
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error?.message || 'Failed to load payout candidates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayouts({ readyOnly: true, query: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clearReferralRequest(row) {
    const uid = String(row?.userId || '').trim();
    if (!uid) return;
    setTogglingId(uid);
    try {
      const res = await fetch('/api/v2/admin/wallet/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, clearReferralWithdrawal: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CLEAR_REFERRAL_FAILED');
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

  async function bulkReferral(action) {
    const userIds = [...selectedIds];
    if (!userIds.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/v2/admin/wallet/payouts/referral-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, userIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'BULK_REFERRAL_FAILED');
      toast.success(`${action}: ${json.data?.processed ?? 0} wallet(s)`);
      await loadPayouts();
    } catch (error) {
      toast.error(error?.message || 'Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleVerify(row) {
    const uid = String(row?.userId || '').trim();
    if (!uid) return;
    setTogglingId(uid);
    try {
      const res = await fetch('/api/v2/admin/wallet/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          verifiedForPayout: !(row?.verifiedForPayout === true),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'VERIFY_TOGGLE_FAILED');
      toast.success('Payout verification flag updated');
      await loadPayouts();
    } catch (error) {
      toast.error(error?.message || 'Failed to update payout flag');
    } finally {
      setTogglingId('');
    }
  }

  const blockersMap = useMemo(() => {
    const map = {
      BELOW_MIN_PAYOUT: `Balance below min threshold (${formatThb(minPayoutThb)} THB)`,
      PROFILE_NOT_VERIFIED: 'Profile is not verified',
      WALLET_NOT_CLEARED_FOR_PAYOUT: 'Доступен вывод: нет (нужен допуск админа)',
    };
    return map;
  }, [minPayoutThb]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to marketing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Payout readiness</h1>
          <p className="text-sm text-slate-600 mt-1">
            Users with wallet balance above threshold and profile verification gate.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPayouts()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Min payout threshold</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatThb(minPayoutThb)} THB</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Ready users</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{readyCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Ready withdrawable total</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatThb(readyWithdrawableTotalThb)} THB</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by user id, email, or name.</CardDescription>
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                id="ready-only"
                type="checkbox"
                checked={readyOnly}
                onChange={(e) => setReadyOnly(e.target.checked)}
              />
              <Label htmlFor="ready-only">Ready only</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="referral-only"
                type="checkbox"
                checked={referralOnly}
                onChange={(e) => setReferralOnly(e.target.checked)}
              />
              <Label htmlFor="referral-only">Referral queue only</Label>
            </div>
          </div>
          <Button onClick={() => void loadPayouts({ readyOnly, referralOnly, query })}>Apply</Button>
        </CardContent>
      </Card>

      {referralOnly && rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={bulkBusy || selectedIds.size === 0}
            onClick={() => void bulkReferral('approve')}
          >
            Approve selected ({selectedIds.size})
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={bulkBusy || selectedIds.size === 0}
            onClick={() => void bulkReferral('reject')}
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
          <CardTitle>Users</CardTitle>
          <CardDescription>Переключатель «Доступен вывод» управляет доступом к выплате на карту/банк.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500 py-10 text-center">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">No payout candidates.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {referralOnly ? <TableHead className="w-10" /> : null}
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
                    {referralOnly ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.userId)}
                          onChange={() => toggleSelect(row.userId)}
                          aria-label={`Select ${row.userId}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="font-medium">{userLabel(row)}</div>
                      <div className="text-xs text-slate-500 font-mono break-all">{row.userId}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatThb(row.withdrawableBalanceThb)} THB</TableCell>
                    <TableCell className="text-right tabular-nums">{formatThb(row.internalCreditsThb)} THB</TableCell>
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
                        <span className="text-emerald-700">Ready for payout</span>
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
    </div>
  );
}

