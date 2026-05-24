'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Download, Loader2, Package, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { postLegalTestFullPackage } from '@/lib/admin/admin-fintech-api-client'

function fmtMs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '—'
  if (n < 1000) return `${Math.round(n)} мс`
  return `${(n / 1000).toFixed(1)} с`
}

export function AdminLegalFullPackageCard() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null)

  const runFullPackage = async () => {
    setBusy(true)
    setResult(null)
    try {
      const { ok, data, json } = await postLegalTestFullPackage({ rail: 'all' })
      if (!ok) {
        setResult(data || { ok: false, steps: data?.steps || [] })
        setOpen(true)
        throw new Error(data?.message || json.error || 'Тест не пройден')
      }
      setResult(data)
      setOpen(true)
      toast({
        title: 'Тестовый пакет готов',
        description: data?.message || 'Все шаги пройдены.',
      })
    } catch (e) {
      if (!open) setOpen(true)
      toast({
        title: 'Тест не пройден',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const steps = result?.steps || []
  const ctx = result?.context || {}

  return (
    <>
      <Card className="border-2 border-brand/30 bg-gradient-to-br from-brand/10 to-white shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-brand">
            <Package className="h-6 w-6 text-brand" />
            Тест перед первой выплатой
          </CardTitle>
          <CardDescription className="text-base text-brand/80">
            Одна кнопка проверяет всю цепочку: гость и партнёр → объявление → оплата → пул → PDF-акты →
            ZIP для банка → акты в кабинете партнёра. Данные помечены как тестовые.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="lg"
            className="w-full sm:w-auto h-14 text-base px-8 bg-brand hover:bg-brand-hover"
            onClick={runFullPackage}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Проверяем цепочку… (до 2 мин)
              </>
            ) : (
              <>
                <Package className="h-5 w-5 mr-2" />
                Сгенерировать тестовый полный пакет
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            То же самое из терминала:{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">npm run smoke:full-financial</code>
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.ok ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              {result?.ok ? 'Все проверки пройдены' : 'Есть ошибки'}
            </DialogTitle>
            <DialogDescription>
              {result?.ok
                ? `Время: ${fmtMs(result.totalDurationMs)}. Можно переходить к реальным выплатам по чеклисту.`
                : 'Исправьте шаги с ошибкой или обратитесь к разработчику.'}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2',
                  s.ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50',
                )}
              >
                {s.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtMs(s.durationMs)}
                    {s.detail ? ` · ${s.detail}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {ctx.batchId ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/settings/finances">Финансовый пульт</Link>
              </Button>
              {ctx.bankPackageUrl ? (
                <Button size="sm" asChild>
                  <a href={ctx.bankPackageUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Скачать ZIP пакета
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
