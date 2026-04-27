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
  const [minPayoutThb, setMinPayoutThb] = useState(1000);
  const [readyCount, setReadyCount] = useState(0);
  const [readyWithdrawableTotalThb, setReadyWithdrawableTotalThb] = useState(0);
  const [togglingId, setTogglingId] = useState('');

  async function loadPayouts(opts = {}) {
    const nextReadyOnly = opts.readyOnly ?? readyOnly;
    const nextQuery = opts.query ?? query;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '250');
      params.set('readyOnly', nextReadyOnly ? '1' : '0');
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
      WALLET_NOT_CLEARED_FOR_PAYOUT: 'Wallet not cleared by admin',
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Toggle <code>verified_for_payout</code> to control card/bank payout access.
          </CardDescription>
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
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Withdrawable</TableHead>
                  <TableHead className="text-right">Internal</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Payout flag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
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
                          <CheckCircle2 className="h-4 w-4" /> enabled
                        </span>
                      ) : (
                        <span className="text-rose-700 text-xs">disabled</span>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={row.verifiedForPayout ? 'outline' : 'default'}
                        disabled={togglingId === row.userId}
                        onClick={() => void toggleVerify(row)}
                      >
                        {togglingId === row.userId
                          ? '...'
                          : row.verifiedForPayout
                            ? 'Disable payout'
                            : 'Verify for payout'}
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

