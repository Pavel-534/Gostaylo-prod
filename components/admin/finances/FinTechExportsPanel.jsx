'use client'

import { Download, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FINTECH_MINT, FINTECH_NAVY } from '@/lib/admin/fintech-console-shared'

/**
 * Stage 109.0 — вкладка «Выгрузки» FinTech-пульта (только без режима владельца).
 */
export function FinTechExportsPanel({
  monthlyExporting,
  exportMonthBundle,
  complianceBooking,
  setComplianceBooking,
  complianceFrom,
  setComplianceFrom,
  complianceTo,
  setComplianceTo,
  complianceDownloading,
  downloadCompliance,
}) {
  return (
    <div className="space-y-8">
      <Card className="border-slate-200 shadow-sm border-teal-100">
        <CardHeader>
          <CardTitle className="text-lg" style={{ color: FINTECH_NAVY }}>
            Экспорт всего за месяц
          </CardTitle>
          <CardDescription>
            Одним кликом: реестр оплаченных броней + журнал конвертаций (два CSV для бухгалтера).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportMonthBundle} disabled={monthlyExporting} style={{ backgroundColor: FINTECH_MINT }}>
            {monthlyExporting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {monthlyExporting ? 'Формируем…' : 'Скачать пакет за текущий месяц'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
            <Download className="h-5 w-5 text-teal-600" />
            Реестр для банка и бухгалтерии
          </CardTitle>
          <CardDescription>
            Выгрузка для бухгалтерии и валютного контроля. Период — по <strong>дате оплаты</strong> гостя, не
            по дате создания брони. Файл с разделителем «;» — открывается в Excel без настроек.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Номер брони (UUID)</Label>
              <Input
                placeholder="если нужна одна бронь"
                value={complianceBooking}
                onChange={(e) => setComplianceBooking(e.target.value)}
                className="w-64"
              />
            </div>
            <div>
              <Label className="text-xs">Период: с</Label>
              <Input type="date" value={complianceFrom} onChange={(e) => setComplianceFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">по</Label>
              <Input type="date" value={complianceTo} onChange={(e) => setComplianceTo(e.target.value)} />
            </div>
            <Button
              onClick={downloadCompliance}
              disabled={complianceDownloading}
              style={{ backgroundColor: FINTECH_NAVY }}
            >
              <Download className="h-4 w-4 mr-1" />
              {complianceDownloading ? 'Формируем…' : 'Скачать CSV'}
            </Button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            В файле: номер брони, дата оплаты, объявление, тип услуги, статус, суммы в батах и рублях, курс,
            статус онлайн-кассы. Если строк нет — в файле будет пояснение; проверьте другой период или вставьте
            UUID оплаченной брони.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
