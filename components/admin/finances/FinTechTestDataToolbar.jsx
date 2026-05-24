'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Crown, Eye, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { postAdminCleanTestData } from '@/lib/admin/admin-fintech-api-client'

const STORAGE_KEY_REAL = 'fintech-real-data-only'
const STORAGE_KEY_OWNER = 'fintech-owner-mode'

const COUNT_LABELS = {
  bookings: 'брони',
  payoutBatches: 'пулы выплат',
  profiles: 'профили smoke',
  payouts: 'выплаты',
  ledgerJournals: 'журналы ledger',
  ledgerEntries: 'проводки ledger',
  conversations: 'чаты',
  listings: 'листинги',
  treasuryAlerts: 'алерты казначейства',
  criticalSignals: 'сигналы',
}

/**
 * Stage 106.5 — фильтры, режим владельца, агрессивная очистка с точным счётчиком.
 */
export function FinTechTestDataToolbar({
  realDataOnly,
  onRealDataOnlyChange,
  ownerMode,
  onOwnerModeChange,
  onCleaned,
}) {
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewTotal, setPreviewTotal] = useState(null)
  const [previewCounts, setPreviewCounts] = useState(null)

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const { ok, data, json } = await postAdminCleanTestData({ dryRun: true })
      if (!ok) throw new Error(json.error || `HTTP ${json.status}`)
      setPreviewTotal(data?.total ?? 0)
      setPreviewCounts(data?.counts || data?.breakdown || null)
    } catch {
      setPreviewTotal(null)
      setPreviewCounts(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  useEffect(() => {
    if (!confirmOpen) return
    void loadPreview()
  }, [confirmOpen, loadPreview])

  const runCleanup = async () => {
    setCleaning(true)
    try {
      const { ok, data, json } = await postAdminCleanTestData({ confirm: true })
      if (!ok) {
        throw new Error(json.message || json.error || `HTTP ${json.status}`)
      }
      const total = data?.totalDeleted ?? data?.total ?? 0
      toast({
        title: `Тестовые данные удалены (${total} записей)`,
        description: 'Пулы, журнал, ledger и алерты обновлены.',
      })
      setConfirmOpen(false)
      setPreviewTotal(0)
      setPreviewCounts(null)
      await loadPreview()
      onCleaned?.()
    } catch (e) {
      toast({
        title: 'Не удалось очистить',
        description: e?.message || 'Ошибка',
        variant: 'destructive',
      })
    } finally {
      setCleaning(false)
    }
  }

  return (
    <>
      <Card
        className={cn(
          'border-2 shadow-md overflow-hidden',
          realDataOnly ? 'border-brand/40 bg-gradient-to-br from-brand/10 via-white to-emerald-50/50' : 'border-red-300 bg-gradient-to-br from-red-50 via-white to-amber-50/40',
        )}
      >
        <CardContent className="py-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex-1">
                <Crown className={cn('h-5 w-5 shrink-0', ownerMode ? 'text-amber-600' : 'text-slate-400')} />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Switch id="fintech-owner-mode" checked={ownerMode} onCheckedChange={onOwnerModeChange} />
                    <Label htmlFor="fintech-owner-mode" className="font-medium cursor-pointer text-sm">
                      Режим владельца
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-10">
                    Скрыты технические коды: выплаты, пулы, журнал — только понятные названия для владельца.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-sm flex-1 ring-2',
                  realDataOnly ? 'border-brand/30 bg-brand/10 ring-brand/40' : 'border-amber-200 bg-amber-50/60 ring-amber-300/50',
                )}
              >
                <Eye className={cn('h-5 w-5 shrink-0', realDataOnly ? 'text-brand-hover' : 'text-amber-700')} />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Switch
                      id="fintech-real-only"
                      checked={realDataOnly}
                      onCheckedChange={onRealDataOnlyChange}
                    />
                    <Label htmlFor="fintech-real-only" className="font-semibold cursor-pointer text-sm text-brand">
                      Только реальные данные
                    </Label>
                    {realDataOnly ? (
                      <Badge className="bg-brand hover:bg-brand">вкл.</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-800">
                        показан весь мусор
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pl-10">
                    Скрывает smoke/E2E в пулах, журнале и конвертациях. Сохраняется в браузере.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              disabled={cleaning}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                'w-full xl:w-auto xl:min-w-[300px] h-auto min-h-14 px-6 py-3 flex flex-col items-center gap-0.5',
                'bg-red-600 hover:bg-red-700 text-white shadow-lg ring-2 ring-red-400/50',
              )}
            >
              <span className="flex items-center text-lg font-bold">
                {cleaning ? (
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-6 w-6 mr-2" />
                )}
                Запустить полную очистку тестовых данных
              </span>
              {previewLoading ? (
                <span className="text-xs font-normal opacity-90">считаем записи…</span>
              ) : previewTotal != null ? (
                <span className="text-xs font-normal opacity-95">
                  будет удалено: <strong>{previewTotal}</strong> записей
                </span>
              ) : null}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 text-xl">
              <AlertTriangle className="h-6 w-6" />
              Удалить весь тестовый мусор?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {previewLoading ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Считаем тестовые записи…
                  </p>
                ) : previewTotal != null ? (
                  <p className="text-base text-slate-900">
                    Будет удалено ровно{' '}
                    <Badge variant="destructive" className="text-base px-2 py-0.5">
                      {previewTotal}
                    </Badge>{' '}
                    записей (брони, пулы, ledger, журнал, алерты).
                  </p>
                ) : (
                  <p>Будут удалены все записи smoke/E2E и связанный ledger.</p>
                )}
                {previewCounts && typeof previewCounts === 'object' ? (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
                    {Object.entries(previewCounts)
                      .filter(([, n]) => Number(n) > 0)
                      .map(([key, n]) => (
                        <li key={key}>
                          {COUNT_LABELS[key] || key}: <strong>{n}</strong>
                        </li>
                      ))}
                  </ul>
                ) : null}
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Маркеры: stage, smoke, E2E, lst-stage, pb-stage, lj-payout-settled</li>
                  <li>ledger_journals, ledger_entries, treasury_ops_alerts</li>
                  <li>Пустые и полностью тестовые пулы выплат</li>
                </ul>
                <p className="font-semibold text-red-800">Боевые брони и lj-cap реальных гостей не трогаем. Необратимо.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={cleaning || previewLoading}
              className="bg-red-600 hover:bg-red-700 text-base h-11"
              onClick={(e) => {
                e.preventDefault()
                runCleanup()
              }}
            >
              {cleaning ? 'Удаляем…' : `Да, удалить ${previewTotal ?? 'всё'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function readFintechRealDataOnlyPreference(fallback = true) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_REAL)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return fallback
}

export function persistFintechRealDataOnlyPreference(value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_REAL, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readFintechOwnerModePreference(fallback = true) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_OWNER)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return fallback
}

export function persistFintechOwnerModePreference(value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_OWNER, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
