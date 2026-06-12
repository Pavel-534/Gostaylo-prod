'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calculator, Gift, Users, UserPlus, Loader2, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function ResultTile({ icon: Icon, label, amount, hint, tone = 'slate' }) {
  const tones = {
    brand: 'border-brand/30 bg-brand/5 text-brand',
    violet: 'border-violet-200 bg-violet-50/80 text-violet-950',
    teal: 'border-teal-200 bg-teal-50/80 text-teal-950',
    slate: 'border-slate-200 bg-white text-slate-900',
  }
  return (
    <div className={`rounded-xl border p-5 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">฿{fmtThb(amount)}</p>
      {hint ? <p className="mt-1 text-xs opacity-75">{hint}</p> : null}
    </div>
  )
}

export function ReferralCalculatorClient() {
  const { isAuthenticated } = useAuth()
  const { language } = useI18n()
  const [subtotal, setSubtotal] = useState('35000')
  const [guestFee, setGuestFee] = useState('15')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const runCalc = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        subtotalThb: String(subtotal || '35000'),
        guestFeePercent: String(guestFee || '15'),
      })
      const res = await fetch(`/api/v2/referral/calculator?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || json.error || 'Ошибка расчёта')
        setResult(null)
      } else {
        setResult(json.data)
      }
    } catch (e) {
      setError(e?.message || 'Ошибка сети')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [subtotal, guestFee])

  useEffect(() => {
    void runCalc()
  }, [runCalc])

  const l2Hint = useMemo(() => {
    if (!result) return ''
    if (result.l2LiveEnabled) return 'L2 начисляется с каждой поездки друга'
    return 'L2 — preview (скоро); caps 500/бронь · 50k/мес'
  }, [result])

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm text-brand font-medium">
          <Calculator className="h-4 w-4" />
          Ambassador Program
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {language === 'en' ? 'Referral earnings calculator' : 'Калькулятор дохода амбассадора'}
        </h1>
        <p className="text-slate-600 max-w-xl mx-auto">
          {language === 'en'
            ? 'Estimate what you, your mentor, and your friend earn per completed trip — based on current program settings.'
            : 'Оцените, сколько получите вы, ваш наставник и друг с одной завершённой поездки — по актуальным настройкам программы.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Параметры брони</CardTitle>
          <CardDescription>Субтотал проживания и сервисный сбор гостя (%)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Субтотал, THB</Label>
              <Input
                id="subtotal"
                type="number"
                min={500}
                step={500}
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestFee">Guest fee, %</Label>
              <Input
                id="guestFee"
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={guestFee}
                onChange={(e) => setGuestFee(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={runCalc} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Пересчитать
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-center text-sm text-rose-600">{error}</p>
      ) : null}

      {result ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <ResultTile
            icon={UserPlus}
            label="Вы (L1)"
            amount={result.l1AmountThb}
            hint={`${result.splitPercents?.l1 ?? 45}% referral pool`}
            tone="brand"
          />
          <ResultTile
            icon={Users}
            label="Наставник (L2)"
            amount={result.l2AmountThb}
            hint={l2Hint}
            tone="violet"
          />
          <ResultTile
            icon={Gift}
            label="Друг (cashback)"
            amount={result.refereeAmountThb}
            hint={`${result.splitPercents?.referee ?? 43}% referral pool`}
            tone="teal"
          />
        </div>
      ) : null}

      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="py-4 flex gap-3 text-sm text-slate-600">
          <Info className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
          <div className="space-y-2">
            <p>{result?.disclaimer || 'Оценка до hold и вывода.'}</p>
            <p>
              Пример: при субтотале <strong>35 000 THB</strong> и fee <strong>15%</strong> — L1{' '}
              <strong>~585 THB</strong>, L2 <strong>~156 THB</strong>, друг <strong>~559 THB</strong>{' '}
              (itemized waterfall, launch preset).
            </p>
            {isAuthenticated ? (
              <Link href="/profile/referral" className="text-brand font-medium underline">
                Мой реферальный кабинет →
              </Link>
            ) : (
              <Link href="/login?next=/about/referral" className="text-brand font-medium underline">
                Войти и получить ссылку →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
