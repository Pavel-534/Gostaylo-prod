'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Loader2 } from 'lucide-react'

export default function AdminAiUsagePage() {
  const [loading, setLoading] = useState(true)
  const [totalUsd, setTotalUsd] = useState(0)
  const [requestCount, setRequestCount] = useState(0)
  const [month, setMonth] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/v2/admin/ai-usage', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success && j.data) {
          setTotalUsd(typeof j.data.totalUsd === 'number' ? j.data.totalUsd : 0)
          setRequestCount(typeof j.data.requestCount === 'number' ? j.data.requestCount : 0)
          setMonth(j.data.month || '')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Расходы OpenAI</h1>
        <p className="text-sm text-slate-600 mt-1">
          Оценка по логам <code className="text-xs bg-slate-100 px-1 rounded">ai_usage_logs</code> за текущий
          календарный месяц (UTC). Видно только администраторам.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Сводка за месяц {month ? `(${month})` : ''}
          </CardTitle>
          <CardDescription>
            Стоимость рассчитана по токенам и публичным тарифам (см. env{' '}
            <code className="text-xs">OPENAI_PRICE_*</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Сумма (USD), оценка
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">${totalUsd.toFixed(4)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Записей в логе
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{requestCount}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Партнёрам стоимость не показывается; у них только лимит попыток генерации описания (3 на объект).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
