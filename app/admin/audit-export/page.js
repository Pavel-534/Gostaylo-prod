'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AuditExportPage() {
  const [date, setDate] = useState(todayIsoDate());
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  async function download(type) {
    const d = date?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      toast.error('Укажите дату в формате YYYY-MM-DD');
      return;
    }
    const setLoading = type === 'audit_logs' ? setLoadingAudit : setLoadingBookings;
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/export?type=${type}&date=${encodeURIComponent(d)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] || `${type}_${d}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Файл скачан');
    } catch (e) {
      toast.error(e.message || 'Ошибка выгрузки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-2xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Экспорт журнала и бронирований
          </CardTitle>
          <CardDescription>
            CSV за выбранный календарный день (UTC): события аудита (брони, платежи) и строки бронирований,
            у которых в этот день были <code className="text-xs">created_at</code> или{' '}
            <code className="text-xs">updated_at</code>. Нужна миграция{' '}
            <code className="text-xs">004_listing_storage_cleanup_and_audit_logs.sql</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="export-date">Дата (UTC)</Label>
            <Input
              id="export-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="default"
              className="gap-2"
              disabled={loadingAudit}
              onClick={() => download('audit_logs')}
            >
              <Download className="h-4 w-4" />
              {loadingAudit ? '…' : 'Скачать audit_logs'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={loadingBookings}
              onClick={() => download('bookings')}
            >
              <Download className="h-4 w-4" />
              {loadingBookings ? '…' : 'Скачать bookings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
