'use client'

import { FileStack } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TREASURY_DAILY_STEPS, resolvePayoutRailLabel } from '@/lib/admin/fintech-ui-labels'
import { FINTECH_MINT, FINTECH_NAVY, fmtThb } from '@/lib/admin/fintech-console-shared'
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState'
import { PayoutBatchRow } from '@/components/admin/finances/PayoutBatchRow'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

/**
 * Stage 109.0 — вкладка «Пулы выплат» FinTech-пульта.
 */
export function PayoutBatchesPanel({
  ownerMode,
  dash,
  poolRail,
  setPoolRail,
  batchRailFilter,
  setBatchRailFilter,
  visibleBatches,
  settlingBatchId,
  createPool,
  lockBatch,
  exportBatch,
  downloadBankPackage,
  markBatchPaid,
}) {
  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'overflow-hidden sm:border-brand/20 sm:shadow-md')}>
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'pb-2 max-sm:border-l-0 sm:border-l-4')} style={{ borderLeftColor: FINTECH_MINT }}>
        <CardTitle className="text-lg" style={{ color: FINTECH_NAVY }}>
          Пулы выплат партнёрам
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block font-medium text-amber-900">
            Concierge Launch: банк не подключён автоматически — каждый перевод делаете вы.
          </span>
          <span className="block">
            Обычно пул в понедельник и четверг: «Сформировать пул» → Lock → CSV/ZIP в банк → перевод →
            «Закрыть пул». Брони берутся со статусом «Готово к выплате».
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
        <ol className="flex flex-wrap gap-2 text-xs text-slate-600 list-none p-0 m-0">
          {TREASURY_DAILY_STEPS.map((step, i) => (
            <li key={step} className="rounded-full bg-slate-100 px-2.5 py-1">
              {i + 1}. {step}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-sm text-slate-600">
            {ownerMode ? 'Куда выплачиваем' : 'Рельс выплат'}
          </Label>
          <select
            className="min-h-[44px] h-11 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={poolRail}
            onChange={(e) => setPoolRail(e.target.value)}
          >
            <option value="TBANK_RU">{resolvePayoutRailLabel('TBANK_RU', ownerMode)}</option>
            <option value="KG_CRYPTO">{resolvePayoutRailLabel('KG_CRYPTO', ownerMode)}</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            className="min-h-[44px] h-12 w-full px-8 text-base sm:w-auto"
            style={{ backgroundColor: FINTECH_MINT }}
            onClick={() => createPool(false)}
          >
            Сформировать пул ({resolvePayoutRailLabel(poolRail, ownerMode)})
          </Button>
          <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={() => createPool(true)}>
            {ownerMode ? 'Сформировать вне расписания' : 'Вне расписания (форс)'}
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Готово по рельсу:{' '}
          <strong>
            {poolRail === 'TBANK_RU' ? dash?.rails?.TBANK_RU?.readyCount : dash?.rails?.KG_CRYPTO?.readyCount}
          </strong>{' '}
          броней ·{' '}
          <strong>
            {fmtThb(
              poolRail === 'TBANK_RU' ? dash?.rails?.TBANK_RU?.readyThb : dash?.rails?.KG_CRYPTO?.readyThb,
            )}
          </strong>
          {' · '}
          всего {dash?.payout?.readyForPayoutCount ?? 0} / {fmtThb(dash?.payout?.readyForPayoutThb)}
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-slate-500">Показать пулы:</span>
          {['ALL', 'TBANK_RU', 'KG_CRYPTO'].map((key) => (
            <Button
              key={key}
              size="sm"
              variant={batchRailFilter === key ? 'default' : 'outline'}
              onClick={() => setBatchRailFilter(key)}
            >
              {key === 'ALL' ? 'Все' : resolvePayoutRailLabel(key, ownerMode)}
            </Button>
          ))}
        </div>
        {visibleBatches.length === 0 ? (
          <FinTechEmptyState
            icon={FileStack}
            title="Пулов выплат ещё нет"
            description="Когда появятся брони «Готово к выплате», нажмите кнопку выше — здесь появится черновик для банка."
          />
        ) : (
          <div className="space-y-3">
            {visibleBatches.map((b) => (
              <PayoutBatchRow
                key={b.id}
                batch={b}
                ownerMode={ownerMode}
                settling={settlingBatchId === b.id}
                onLock={lockBatch}
                onExport={exportBatch}
                onBankPackage={downloadBankPackage}
                onSettle={markBatchPaid}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
