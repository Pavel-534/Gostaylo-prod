'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

async function downloadBlob(url, label, defaultExt = 'csv') {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Export failed: ${label}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `export-${Date.now()}.${defaultExt}`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
  const rows = res.headers.get('X-Row-Count');
  toast.success(`${label}${rows ? ` · ${rows} строк` : ''}`);
}

/**
 * @param {{ period?: string, selectedBookingIds?: string[], triggerClassName?: string }} props
 */
export function IntelligenceExportMenu({ period = '30d', selectedBookingIds = [], triggerClassName }) {
  const [loading, setLoading] = useState(false);

  const run = async (url, label, ext = 'csv') => {
    setLoading(true);
    try {
      await downloadBlob(url, label, ext);
    } catch (e) {
      toast.error(e?.message || 'Не удалось выгрузить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading} className={triggerClassName || 'h-9'}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Экспорт
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Выгрузки</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            run(`/api/admin/finance/intelligence/pdf?type=summary&period=${period}&excludeTest=1`, 'PDF сводка', 'pdf')
          }
        >
          <FileText className="h-4 w-4 mr-2 text-rose-600" />
          PDF — сводка за период
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] text-slate-400 font-normal">Excel (с формулами)</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            run(
              `/api/admin/finance/intelligence/export?type=summary-xlsx&period=${period}&excludeTest=1`,
              'Excel сводка',
              'xlsx',
            )
          }
        >
          <FileText className="h-4 w-4 mr-2 text-emerald-600" />
          Excel — сводка за период
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            run(
              `/api/admin/finance/intelligence/export?type=bookings-xlsx&period=${period}&excludeTest=1`,
              'Excel брони P&L',
              'xlsx',
            )
          }
        >
          <FileText className="h-4 w-4 mr-2 text-emerald-600" />
          Excel — все брони с P&L
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            run(
              `/api/admin/finance/intelligence/export?type=escrow-aging-xlsx&minDays=7&excludeTest=1`,
              'Excel escrow aging',
              'xlsx',
            )
          }
        >
          <FileText className="h-4 w-4 mr-2 text-emerald-600" />
          Excel — Escrow aging
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] text-slate-400 font-normal">CSV</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            run(`/api/admin/finance/intelligence/export?type=bookings&period=${period}&excludeTest=1`, 'CSV брони')
          }
        >
          Все бронирования за период
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            run(
              `/api/admin/finance/intelligence/export?type=escrow-aging&minDays=7&excludeTest=1`,
              'CSV escrow aging',
            )
          }
        >
          Escrow aging (&gt;7 дней)
        </DropdownMenuItem>
        {selectedBookingIds.length > 0 ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                `/api/admin/finance/intelligence/export?type=pl-batch&bookingIds=${selectedBookingIds.join(',')}`,
                'CSV P&L batch',
              )
            }
          >
            P&L batch ({selectedBookingIds.length} броней)
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>P&L batch CSV — откройте таблицу броней</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default IntelligenceExportMenu;
