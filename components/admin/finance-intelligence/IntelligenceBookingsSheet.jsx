'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
  'PAID',
];

const FILTER_PRESETS = [
  { id: 'real-live', label: 'Real Payments Only' },
  { id: 'period', label: 'За период' },
  { id: 'aging7', label: 'Застряли >7 дн.' },
  { id: 'referral', label: 'С рефералом' },
  { id: 'no-referral', label: 'Без реферала' },
];

function fmtBookingId(id) {
  const s = String(id || '');
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…`;
}

function applyPreset(presetId) {
  switch (presetId) {
    case 'real-live':
      return {
        pipelineOnly: true,
        escrowAgingMinDays: null,
        hasReferral: null,
        categorySlug: null,
        partnerId: null,
        partnerPipelineOnly: false,
        status: '',
      };
    case 'aging7':
      return {
        pipelineOnly: true,
        escrowAgingMinDays: 7,
        hasReferral: null,
        categorySlug: null,
        partnerId: null,
        partnerPipelineOnly: false,
      };
    case 'referral':
      return {
        pipelineOnly: false,
        escrowAgingMinDays: null,
        hasReferral: true,
        categorySlug: null,
        partnerId: null,
        partnerPipelineOnly: false,
      };
    case 'no-referral':
      return {
        pipelineOnly: false,
        escrowAgingMinDays: null,
        hasReferral: false,
        categorySlug: null,
        partnerId: null,
        partnerPipelineOnly: false,
      };
    default:
      return {
        pipelineOnly: false,
        escrowAgingMinDays: null,
        hasReferral: null,
        categorySlug: null,
        partnerId: null,
        partnerPipelineOnly: false,
      };
  }
}

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   period?: string,
 *   initialFilters?: {
 *     pipelineOnly?: boolean,
 *     escrowAgingMinDays?: number | null,
 *     status?: string | null,
 *     hasReferral?: boolean | null,
 *     categorySlug?: string | null,
 *     partnerId?: string | null,
 *     partnerName?: string | null,
 *     partnerPipelineOnly?: boolean,
 *     filterTitle?: string | null,
 *   },
 *   onSelectBooking?: (bookingId: string) => void,
 *   onRowsLoaded?: (bookingIds: string[]) => void,
 * }} props
 */
export function IntelligenceBookingsSheet({
  open,
  onOpenChange,
  period = '30d',
  initialFilters = {},
  onSelectBooking,
  onRowsLoaded,
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, hasMore: false });
  const [filterTitle, setFilterTitle] = useState(initialFilters.filterTitle || null);
  const [status, setStatus] = useState(initialFilters.status || '');
  const [categorySlug, setCategorySlug] = useState(initialFilters.categorySlug || '');
  const [partnerId, setPartnerId] = useState(initialFilters.partnerId || '');
  const [partnerPipelineOnly, setPartnerPipelineOnly] = useState(
    Boolean(initialFilters.partnerPipelineOnly),
  );
  const [hasReferral, setHasReferral] = useState(
    initialFilters.hasReferral == null ? 'all' : initialFilters.hasReferral ? '1' : '0',
  );
  const [pipelineOnly, setPipelineOnly] = useState(Boolean(initialFilters.pipelineOnly));
  const [escrowAgingMinDays, setEscrowAgingMinDays] = useState(
    initialFilters.escrowAgingMinDays != null ? String(initialFilters.escrowAgingMinDays) : '',
  );
  const [activePreset, setActivePreset] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        page: String(page),
        pageSize: '25',
        excludeTest: '1',
      });
      if (status) params.set('status', status);
      if (categorySlug) params.set('category', categorySlug);
      if (partnerId) params.set('partnerId', partnerId);
      if (partnerPipelineOnly) params.set('partnerPipelineOnly', '1');
      if (hasReferral === '1') params.set('hasReferral', '1');
      if (hasReferral === '0') params.set('hasReferral', '0');
      if (pipelineOnly) params.set('pipelineOnly', '1');
      if (escrowAgingMinDays) params.set('escrowAgingMinDays', escrowAgingMinDays);

      const res = await fetch(`/api/admin/finance/intelligence/bookings?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'BOOKINGS_LOAD_FAILED');
      setRows(json.data?.rows || []);
      setPagination(json.data?.pagination || { page: 1, pageSize: 25, total: 0, hasMore: false });
      const loadedRows = json.data?.rows || [];
      onRowsLoaded?.(loadedRows.map((r) => r.bookingId).filter(Boolean));
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить брони');
    } finally {
      setLoading(false);
    }
  }, [
    period,
    page,
    status,
    categorySlug,
    partnerId,
    partnerPipelineOnly,
    hasReferral,
    pipelineOnly,
    escrowAgingMinDays,
    onRowsLoaded,
  ]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    setFilterTitle(initialFilters.filterTitle || null);
    setPipelineOnly(Boolean(initialFilters.pipelineOnly));
    setPartnerPipelineOnly(Boolean(initialFilters.partnerPipelineOnly));
    setEscrowAgingMinDays(
      initialFilters.escrowAgingMinDays != null ? String(initialFilters.escrowAgingMinDays) : '',
    );
    setStatus(initialFilters.status || '');
    setCategorySlug(initialFilters.categorySlug || '');
    setPartnerId(initialFilters.partnerId || '');
    setHasReferral(
      initialFilters.hasReferral == null ? 'all' : initialFilters.hasReferral ? '1' : '0',
    );
    setActivePreset('');
    setPage(1);
  }, [
    open,
    initialFilters.filterTitle,
    initialFilters.pipelineOnly,
    initialFilters.partnerPipelineOnly,
    initialFilters.escrowAgingMinDays,
    initialFilters.status,
    initialFilters.categorySlug,
    initialFilters.partnerId,
    initialFilters.hasReferral,
  ]);

  const applyQuickPreset = (presetId) => {
    const next = applyPreset(presetId);
    setActivePreset(presetId);
    setPipelineOnly(next.pipelineOnly);
    setEscrowAgingMinDays(next.escrowAgingMinDays != null ? String(next.escrowAgingMinDays) : '');
    setHasReferral(next.hasReferral == null ? 'all' : next.hasReferral ? '1' : '0');
    if (!categorySlug && !partnerId) {
      setCategorySlug(next.categorySlug || '');
      setPartnerId(next.partnerId || '');
      setPartnerPipelineOnly(next.partnerPipelineOnly);
    }
    setFilterTitle(null);
    setPage(1);
  };

  const clearDrillFilters = () => {
    setCategorySlug('');
    setPartnerId('');
    setPartnerPipelineOnly(false);
    setFilterTitle(null);
    setPage(1);
  };

  const hasDrillFilter = Boolean(categorySlug || partnerId);

  const sheetTitle = filterTitle || 'Бронирования';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            Real Payments Only — smoke/E2E скрыты. Клик по строке → P&amp;L брони.
          </SheetDescription>
        </SheetHeader>

        {hasDrillFilter ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {categorySlug ? (
              <Badge variant="secondary" className="text-xs">
                Вертикаль: {categorySlug}
              </Badge>
            ) : null}
            {partnerId ? (
              <Badge variant="secondary" className="text-xs font-mono max-w-[200px] truncate">
                Партнёр: {initialFilters.partnerName || partnerId.slice(0, 14)}
                {partnerPipelineOnly ? ' · эскроу' : ''}
              </Badge>
            ) : null}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearDrillFilters}>
              <X className="h-3 w-3 mr-1" />
              Сбросить
            </Button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyQuickPreset(p.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                activePreset === p.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={hasReferral} onValueChange={(v) => { setHasReferral(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Реферал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Реферал: все</SelectItem>
              <SelectItem value="1">С рефералом</SelectItem>
              <SelectItem value="0">Без реферала</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={escrowAgingMinDays || 'none'}
            onValueChange={(v) => {
              const aging = v === 'none' ? '' : v;
              setEscrowAgingMinDays(aging);
              setPipelineOnly(Boolean(aging));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Задержка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без задержки</SelectItem>
              <SelectItem value="7">Эскроу &gt; 7 дн.</SelectItem>
              <SelectItem value="14">Эскроу &gt; 14 дн.</SelectItem>
              <SelectItem value="30">Эскроу &gt; 30 дн.</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-9" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Обновить'}
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Бронь</th>
                  <th className="text-left px-3 py-2">Статус</th>
                  <th className="text-right px-3 py-2">Оборот</th>
                  <th className="text-right px-3 py-2">Маржа</th>
                  <th className="text-right px-3 py-2">Партнёру</th>
                  <th className="text-right px-3 py-2">Дней</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Загрузка…
                    </td>
                  </tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Нет броней по фильтрам
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <tr
                    key={row.bookingId}
                    className="border-t border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition"
                    onClick={() => onSelectBooking?.(row.bookingId)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs">{fmtBookingId(row.bookingId)}</div>
                      <div className="text-[10px] text-slate-400">{row.categorySlug || '—'}</div>
                      {row.hasReferralAttribution ? (
                        <Badge variant="outline" className="mt-1 text-[10px] h-5">реф.</Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className="font-mono text-[10px]">{row.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <AdminTableAmount value={row.subtotalThb} showPlus={false} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <AdminTableAmount value={row.platformMarginThb} showPlus={false} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <AdminTableAmount value={row.partnerPayoutThb} showPlus={false} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-slate-600">
                      {row.pipelineAgeDays != null ? `${row.pipelineAgeDays}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Стр. {pagination.page} · всего ~{pagination.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!pagination.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default IntelligenceBookingsSheet;
