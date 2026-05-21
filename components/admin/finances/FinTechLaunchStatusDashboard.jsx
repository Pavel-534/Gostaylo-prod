'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Play,
  Shield,
  XCircle,
  MinusCircle,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  postLegalTestFullPackage,
  postFintechPreparePause,
} from '@/lib/admin/admin-fintech-api-client'

const STATUS_STYLES = {
  green: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/80',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  yellow: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/80',
    icon: MinusCircle,
    iconClass: 'text-amber-600',
    dot: 'bg-amber-500',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50/80',
    icon: XCircle,
    iconClass: 'text-red-600',
    dot: 'bg-red-500',
  },
}

/**
 * Stage 106.3 — главная карточка готовности + «Подготовить к паузе».
 */
export function FinTechLaunchStatusDashboard({ readiness, onRefresh }) {
  const { toast } = useToast()
  const [smokeBusy, setSmokeBusy] = useState(false)
  const [pauseBusy, setPauseBusy] = useState(false)
  const [smokeOpen, setSmokeOpen] = useState(false)
  const [smokeResult, setSmokeResult] = useState(null)
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false)

  if (!readiness) return null

  const items = readiness.items || []
  const allOk = readiness.allRequiredReady === true
  const summary = readiness.summary || {}
  const pauseActive = Boolean(readiness.treasury?.emergencyPause?.active)

  const runSmoke = async () => {
    setSmokeBusy(true)
    setSmokeResult(null)
    try {
      const { ok, data, json } = await postLegalTestFullPackage({ rail: 'all' })
      setSmokeResult(data || { ok: false, steps: [] })
      setSmokeOpen(true)
      if (!ok) {
        throw new Error(data?.message || json.error || 'Проверка не пройдена')
      }
      toast({
        title: 'Проверка пройдена',
        description: 'Цепочка от оплаты до выплат работает на тестовых данных.',
      })
      onRefresh?.()
    } catch (e) {
      setSmokeOpen(true)
      toast({ title: 'Есть ошибки в проверке', description: e.message, variant: 'destructive' })
      onRefresh?.()
    } finally {
      setSmokeBusy(false)
    }
  }

  const runPreparePause = async () => {
    setPauseBusy(true)
    setPauseConfirmOpen(false)
    try {
      const { ok, blob, smokeOk, json } = await postFintechPreparePause({
        confirm: true,
        reason: 'Пауза на 1–2 недели: ЮKassa, договоры, ОсОО',
      })
      if (!ok) {
        throw new Error(json?.error || 'Не удалось подготовить систему')
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gostaylo-pause-package-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: 'Система подготовлена к паузе',
        description: smokeOk
          ? 'Архив скачан, пауза включена. Новые оплаты остановлены.'
          : 'Архив скачан, пауза включена. В архиве есть отчёт о проверке — есть ошибки, покажите разработчику.',
        variant: smokeOk ? 'default' : 'destructive',
      })
      onRefresh?.()
    } catch (e) {
      toast({ title: 'Не удалось подготовить к паузе', description: e.message, variant: 'destructive' })
    } finally {
      setPauseBusy(false)
    }
  }

  return (
    <>
      <Card
        className={cn(
          'border-[3px] shadow-xl',
          pauseActive
            ? 'border-slate-400 bg-gradient-to-br from-slate-100 to-white'
            : allOk
              ? 'border-emerald-400 bg-gradient-to-br from-emerald-50/95 to-white'
              : 'border-amber-400 bg-gradient-to-br from-amber-50/70 to-white',
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl sm:text-3xl flex items-center gap-2 text-slate-900">
                <Shield className="h-8 w-8 text-teal-700 shrink-0" />
                Можно ли уже принимать деньги от гостей?
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-base text-slate-700 leading-relaxed">
                Короткая сводка без технических терминов: что уже готово, что стоит доделать перед
                настоящими оплатами. Зелёный — можно готовиться; жёлтый — есть вопросы; красный —
                сначала устраните блокеры или обратитесь к разработчику.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                className={cn(
                  'text-sm px-3 py-1.5',
                  pauseActive
                    ? 'bg-slate-600 hover:bg-slate-600'
                    : allOk
                      ? 'bg-emerald-600 hover:bg-emerald-600'
                      : 'bg-amber-600 hover:bg-amber-600',
                )}
              >
                {pauseActive
                  ? 'Приём оплат на паузе'
                  : allOk
                    ? 'Можно готовиться к запуску'
                    : 'Есть что доделать'}
              </Badge>
              <p className="text-xs text-slate-500 text-right">
                готово: {summary.readyCount ?? 0} · внимание: {summary.warningCount ?? 0} · блокеры:{' '}
                {summary.blockingCount ?? 0}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const st = STATUS_STYLES[item.status] || STATUS_STYLES.red
              const Icon = st.icon
              return (
                <div
                  key={item.id}
                  className={cn('rounded-xl border px-4 py-3 flex gap-3 min-h-[88px]', st.border, st.bg)}
                >
                  <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', st.iconClass)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', st.dot)} />
                      <p className="font-semibold text-slate-900 text-sm leading-tight">{item.label}</p>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 break-words leading-snug">{item.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-4 sm:p-5 space-y-4">
            <p className="font-semibold text-teal-950 text-base">Уходите на 1–2 недели по договорам?</p>
            <p className="text-sm text-teal-900/90 leading-relaxed">
              Одна кнопка: проверит цепочку денег, соберёт архив документов, даст PDF-памятку «что делать
              после возвращения» и включит паузу — новые оплаты не пойдут, пока вы не вернётесь.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="border-teal-600 text-teal-900 hover:bg-teal-100"
                disabled={smokeBusy || pauseBusy}
                onClick={runSmoke}
              >
                {smokeBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Запустить полный smoke
              </Button>
              <Button
                type="button"
                size="lg"
                className="bg-slate-800 hover:bg-slate-900 text-white"
                disabled={pauseBusy || smokeBusy}
                onClick={() => setPauseConfirmOpen(true)}
              >
                {pauseBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4 mr-2" />
                )}
                Подготовить систему к паузе
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={pauseBusy}
                onClick={() => onRefresh?.()}
              >
                Обновить
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Обновлено: {readiness.generatedAt ? new Date(readiness.generatedAt).toLocaleString('ru-RU') : '—'}
            {readiness.lastSmoke?.ranAt && (
              <>
                {' '}
                · Последняя проверка: {new Date(readiness.lastSmoke.ranAt).toLocaleString('ru-RU')}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={pauseConfirmOpen} onOpenChange={setPauseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подготовить систему к паузе?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">Сейчас будет сделано автоматически:</span>
              <span className="block">1. Проверка всей цепочки денег (smoke)</span>
              <span className="block">2. Скачивание ZIP: юридические документы + памятка PDF + отчёт проверки</span>
              <span className="block">3. Включение паузы — новые брони и оплаты остановятся</span>
              <span className="block font-medium text-foreground pt-2">
                Это безопасный режим, пока вы занимаетесь ЮKassa и договорами.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={runPreparePause} className="bg-slate-800 hover:bg-slate-900">
              <Download className="h-4 w-4 mr-2" />
              Да, подготовить и скачать архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={smokeOpen} onOpenChange={setSmokeOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результат проверки (smoke)</DialogTitle>
            <DialogDescription>
              {smokeResult?.ok
                ? 'Все шаги пройдены — технически цепочка работает.'
                : 'Есть шаги с ошибкой — сохраните скрин и покажите разработчику.'}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(smokeResult?.steps || []).map((s, i) => (
              <li
                key={s.id || i}
                className={cn(
                  'flex gap-2 rounded-md px-2 py-1',
                  s.ok ? 'text-emerald-900 bg-emerald-50' : 'text-red-900 bg-red-50',
                )}
              >
                {s.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>
                  <strong>{s.label || s.id}</strong>
                  {s.detail ? ` — ${s.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
