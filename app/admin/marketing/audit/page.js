'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Filter, ArrowLeft } from 'lucide-react';
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

function toTypeLabel(entryType) {
  const t = String(entryType || '').toLowerCase();
  if (t === 'organic_topup') return 'Top-up (Organic)';
  if (t === 'manual_topup') return 'Top-up (Manual)';
  if (t === 'referral_boost_debit') return 'Debit (Boost)';
  if (t === 'manual_debit') return 'Debit (Manual)';
  return t || '—';
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function MarketingTankAuditPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
    bookingId: '',
  });

  async function loadEvents(nextFilters = filters) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', nextFilters.type || 'all');
      if (nextFilters.dateFrom) params.set('dateFrom', nextFilters.dateFrom);
      if (nextFilters.dateTo) params.set('dateTo', nextFilters.dateTo);
      if (nextFilters.bookingId) params.set('bookingId', nextFilters.bookingId);
      params.set('limit', '500');
      const res = await fetch(`/api/v2/admin/referral/tank-events?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'LOAD_FAILED');
      setEvents(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить события бака');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    let topups = 0;
    let debits = 0;
    for (const row of events) {
      const amount = Number(row?.amount_thb) || 0;
      if (amount >= 0) topups += amount;
      if (amount < 0) debits += Math.abs(amount);
    }
    return { topups, debits };
  }, [events]);

  function handleFilterApply() {
    void loadEvents(filters);
  }

  function handleExportCsv() {
    if (!events.length) {
      toast.error('Нет данных для экспорта');
      return;
    }
    const header = ['id', 'created_at', 'entry_type', 'booking_id', 'amount_thb', 'metadata_json'];
    const lines = [header.join(',')];
    for (const row of events) {
      lines.push(
        [
          escapeCsvCell(row.id),
          escapeCsvCell(row.created_at),
          escapeCsvCell(row.entry_type),
          escapeCsvCell(row.booking_id || ''),
          escapeCsvCell(row.amount_thb),
          escapeCsvCell(JSON.stringify(row.metadata || {})),
        ].join(','),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-promo-tank-events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promo Tank Audit Trail</h1>
          <p className="text-sm text-slate-600">Журнал движения marketing promo tank для финансового контроля.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/marketing">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад в Маркетинг
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
          <CardDescription>Тип / Дата / booking_id</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters((p) => ({ ...p, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="topup">Top-up</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Дата с</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Дата по</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>booking_id</Label>
              <Input
                placeholder="booking-..."
                value={filters.bookingId}
                onChange={(e) => setFilters((p) => ({ ...p, bookingId: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleFilterApply} disabled={loading}>
              {loading ? 'Загрузка...' : 'Применить'}
            </Button>
            <Button variant="outline" onClick={handleExportCsv}>
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Итоги выборки</CardTitle>
          <CardDescription>
            Topups: ฿{formatAmount(totals.topups)} / Debits: ฿{formatAmount(totals.debits)} / Rows: {events.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>booking_id</TableHead>
                <TableHead className="text-right">Сумма (THB)</TableHead>
                <TableHead>id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((row) => {
                const amount = Number(row?.amount_thb) || 0;
                return (
                  <TableRow key={row.id}>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{toTypeLabel(row.entry_type)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.booking_id || '—'}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {amount >= 0 ? '+' : '-'}฿{formatAmount(Math.abs(amount))}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-500">{row.id}</TableCell>
                  </TableRow>
                );
              })}
              {!events.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    События не найдены
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

