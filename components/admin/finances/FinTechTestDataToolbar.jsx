'use client'

import { useState } from 'react'
import { AlertTriangle, Filter, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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

const STORAGE_KEY = 'fintech-real-data-only'

/**
 * Stage 106.4 — фильтр «только реальные» + очистка тестового мусора.
 * @param {{ realDataOnly: boolean, onRealDataOnlyChange: (v: boolean) => void, onCleaned?: () => void }} props
 */
export function FinTechTestDataToolbar({ realDataOnly, onRealDataOnlyChange, onCleaned }) {
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const runCleanup = async () => {
    setCleaning(true)
    try {
      const res = await fetch('/api/admin/clean-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`)
      }
      const total = json.data?.total ?? 0
      toast({
        title: `Тестовые данные удалены (${total} записей)`,
        description:
          'Пулы smoke, брони E2E, ledger и тестовые профили smoke убраны. Обновите пульт.',
      })
      setConfirmOpen(false)
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
      <Card className="border-red-200/80 bg-gradient-to-r from-red-50/90 to-white shadow-sm overflow-hidden">
        <CardContent className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <Filter className="h-5 w-5 text-teal-700 shrink-0" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id="fintech-real-only"
                    checked={realDataOnly}
                    onCheckedChange={onRealDataOnlyChange}
                  />
                  <Label htmlFor="fintech-real-only" className="font-medium cursor-pointer text-sm">
                    Показывать только реальные данные
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-10">
                  Скрывает smoke/E2E в пулах, конвертациях и сводках (по умолчанию включено).
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
              'w-full lg:w-auto h-12 px-6 text-base font-semibold',
              'bg-red-600 hover:bg-red-700 text-white shadow-md',
            )}
          >
            {cleaning ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5 mr-2" />
            )}
            🗑️ Очистить ВЕСЬ тестовый мусор
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Удалить все тестовые данные?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Будут удалены записи smoke-тестов и E2E: брони с меткой{' '}
                  <strong>[E2E_TEST_DATA]</strong>, пулы <strong>pb-stage*</strong>, профили{' '}
                  <strong>user-smoke-*</strong>, листинги <strong>lst-stage*</strong>, связанные
                  выплаты и проводки ledger.
                </p>
                <p className="font-medium text-red-800">
                  Боевые брони и реальные партнёры не затрагиваются. Действие необратимо.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={cleaning}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                runCleanup()
              }}
            >
              {cleaning ? 'Удаляем…' : 'Да, удалить тестовые данные'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** @param {boolean} [fallback] */
export function readFintechRealDataOnlyPreference(fallback = true) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return fallback
}

/** @param {boolean} value */
export function persistFintechRealDataOnlyPreference(value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
