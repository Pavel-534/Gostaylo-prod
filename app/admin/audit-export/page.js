'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AuditExportPage() {
  const [date, setDate] = useState(todayIsoDate());
  const [loading, setLoading] = useState({});

  const setKeyLoading = (key, v) => setLoading((prev) => ({ ...prev, [key]: v }));

  async function download(type, fileFormat) {
    const d = date?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      toast.error('Укажите дату');
      return;
    }
    const key = `${type}_${fileFormat}`;
    setKeyLoading(key, true);
    try {
      const res = await fetch(
        `/api/v2/admin/export?type=${type}&date=${encodeURIComponent(d)}&format=${fileFormat}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] || `${type}_${d}.${fileFormat === 'xlsx' ? 'xlsx' : 'csv'}`;
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
      setKeyLoading(key, false);
    }
  }

  const busy = (type, fmt) => !!loading[`${type}_${fmt}`];

  return (
    <div className="container max-w-lg py-6 sm:py-8 px-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileSpreadsheet className="h-5 w-5 text-teal-600 shrink-0" />
            Выгрузка для разборов
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Скачайте журнал событий (брони и платежи) и список бронирований за один день. Удобно открывать в
            Excel или Google Таблицах. Период — один календарный день по UTC (как на сервере).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="export-date" className="text-slate-700">
              Дата
            </Label>
            <Input
              id="export-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-base h-11"
            />
            <p className="text-xs text-slate-500">UTC — то же время, что использует база при фильтрации.</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Журнал событий</p>
              <p className="text-xs text-slate-500 mb-3">
                Все записи аудита за выбранный день: кто что менял в бронях и платежах.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2 h-11 justify-center"
                  disabled={busy('audit_logs', 'csv')}
                  onClick={() => download('audit_logs', 'csv')}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  {busy('audit_logs', 'csv') ? '…' : 'CSV'}
                </Button>
                <Button
                  className="gap-2 h-11 justify-center bg-teal-600 hover:bg-teal-700"
                  disabled={busy('audit_logs', 'xlsx')}
                  onClick={() => download('audit_logs', 'xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  {busy('audit_logs', 'xlsx') ? '…' : 'Excel'}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Бронирования</p>
              <p className="text-xs text-slate-500 mb-3">
                Строки, у которых в этот день было создание или изменение (по данным сервера).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2 h-11 justify-center"
                  disabled={busy('bookings', 'csv')}
                  onClick={() => download('bookings', 'csv')}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  {busy('bookings', 'csv') ? '…' : 'CSV'}
                </Button>
                <Button
                  className="gap-2 h-11 justify-center bg-teal-600 hover:bg-teal-700"
                  disabled={busy('bookings', 'xlsx')}
                  onClick={() => download('bookings', 'xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  {busy('bookings', 'xlsx') ? '…' : 'Excel'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
