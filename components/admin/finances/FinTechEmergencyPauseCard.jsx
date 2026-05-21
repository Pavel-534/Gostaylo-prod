'use client'

import { useState } from 'react'
import { AlertTriangle, OctagonPause, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { patchFintechTreasuryOps } from '@/lib/admin/admin-fintech-api-client'

export function FinTechEmergencyPauseCard({ ops, onUpdated, toast }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const active = Boolean(ops?.emergencyPause?.active)

  const toggle = async (pause) => {
    setBusy(true)
    try {
      const { ok, json } = await patchFintechTreasuryOps({
        emergencyPause: pause,
        reason: pause ? reason || 'Ручная пауза владельца' : undefined,
      })
      if (!ok) {
        toast?.({
          title: 'Не удалось изменить паузу',
          description: json.error || 'Ошибка',
          variant: 'destructive',
        })
        return
      }
      toast?.({
        title: pause ? 'Emergency Pause включён' : 'Платформа снова принимает брони',
        description: pause
          ? 'Новые бронирования и выплаты заблокированы.'
          : 'Проверьте очередь выплат вручную.',
      })
      onUpdated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      className={cn(
        'border-2 shadow-md',
        active ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white',
      )}
    >
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <OctagonPause
            className={cn('h-6 w-6 shrink-0', active ? 'text-red-600' : 'text-slate-400')}
          />
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-lg text-slate-900">Emergency Pause</p>
            <p className="text-sm text-slate-600 mt-1">
              {active
                ? 'Сейчас заблокированы новые бронирования и операции выплат (пулы, закрытие).'
                : 'Экстренная остановка перед инцидентом или проверкой — без отката данных.'}
            </p>
            {active && ops?.emergencyPause?.reason ? (
              <p className="text-xs text-red-800 mt-2">
                <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                {ops.emergencyPause.reason}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-2">
              Ручной режим казначейства:{' '}
              <strong>{ops?.treasuryManualMode !== false ? 'вкл' : 'выкл'}</strong>
              {' · '}
              авто-пулы: <strong>{ops?.treasuryAutoPool ? 'вкл' : 'выкл'}</strong>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {!active ? (
              <>
                <div className="w-full sm:w-64">
                  <Label className="text-xs">Причина (необязательно)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Например: сверка с банком"
                    className="h-9 mt-1"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => toggle(true)}
                  className="w-full sm:w-auto"
                >
                  <OctagonPause className="h-4 w-4 mr-2" />
                  Остановить брони и выплаты
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                disabled={busy}
                onClick={() => toggle(false)}
              >
                <Play className="h-4 w-4 mr-2" />
                Снять паузу
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
