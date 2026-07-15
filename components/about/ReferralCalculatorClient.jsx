'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calculator, Gift, Users, UserPlus, Loader2, Info, CreditCard, Banknote } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { formatNativeAmountInCurrency } from '@/lib/currency'

function ResultTile({ icon: Icon, label, amountThb, hint, tone = 'slate', formatAmount }) {
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
      <p className="mt-2 text-3xl font-bold tabular-nums break-words">{formatAmount(amountThb)}</p>
      {hint ? <p className="mt-1 text-xs opacity-75">{hint}</p> : null}
    </div>
  )
}

function PaymentModeToggle({ mode, onChange, disabled, language }) {
  const isRub = mode === 'RUB_CROSS'
  const localLabel = language === 'en' ? 'Local payment' : 'Оплата на месте'
  const cardLabel = language === 'en' ? 'Card / bank transfer' : 'Картой / переводом'
  return (
    <div className="space-y-2">
      <Label>{language === 'en' ? 'Guest payment method' : 'Как будет платить гость'}</Label>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('THB')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            !isRub
              ? 'bg-white text-brand shadow-sm ring-1 ring-brand/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Banknote className="h-4 w-4" aria-hidden />
          {localLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('RUB_CROSS')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            isRub
              ? 'bg-white text-brand shadow-sm ring-1 ring-brand/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="h-4 w-4" aria-hidden />
          {cardLabel}
        </button>
      </div>
    </div>
  )
}

export function ReferralCalculatorClient() {
  const { isAuthenticated } = useAuth()
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { formatThbAsDisplay, convertThbToDisplay, convertDisplayToThb } = useReferralLedgerDisplay()
  const [subtotalDisplay, setSubtotalDisplay] = useState('')
  const [guestFee, setGuestFee] = useState('15')
  const [paymentMode, setPaymentMode] = useState('THB')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const defaultThb = 35000
    setSubtotalDisplay(String(convertThbToDisplay(defaultThb) || defaultThb))
  }, [currency, convertThbToDisplay])

  const runCalc = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const subtotalThb = Math.max(500, Math.round(convertDisplayToThb(subtotalDisplay) || 35000))
      const qs = new URLSearchParams({
        subtotalThb: String(subtotalThb),
        guestFeePercent: String(guestFee || '15'),
        guestPaymentMode: paymentMode,
      })
      const res = await fetch(`/api/v2/referral/calculator?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || json.error || (language === 'en' ? 'Calculation error' : 'Ошибка расчёта'))
        setResult(null)
      } else {
        setResult(json.data)
      }
    } catch (e) {
      setError(e?.message || (language === 'en' ? 'Network error' : 'Ошибка сети'))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [subtotalDisplay, guestFee, paymentMode, convertDisplayToThb, language])

  useEffect(() => {
    if (!subtotalDisplay) return
    void runCalc()
  }, [runCalc, subtotalDisplay])

  const isRubMode = result?.guestPaymentMode === 'RUB_CROSS'
  const l2Hint = useMemo(() => {
    if (!result) return ''
    if (result.l2LiveEnabled) {
      return language === 'en' ? 'L2 accrues on every friend trip' : 'L2 начисляется с каждой поездки друга'
    }
    return language === 'en'
      ? 'L2 — preview (soon); caps 500/booking · 50k/month'
      : 'L2 — preview (скоро); caps 500/бронь · 50k/мес'
  }, [result, language])

  const bonusMidHint = isRubMode
    ? language === 'en'
      ? 'Bonus from base commission · mid FX rate'
      : 'Бонус от базовой комиссии · mid-курс без FX-маржи'
    : `${result?.splitPercents?.l1 ?? 45}% referral pool`

  const exampleSubtotal = formatThbAsDisplay(35000)
  const exampleL1 = formatThbAsDisplay(585)
  const exampleL2 = formatThbAsDisplay(156)
  const exampleFriend = formatThbAsDisplay(559)

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
          <CardTitle className="text-lg">{language === 'en' ? 'Booking parameters' : 'Параметры брони'}</CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Stay subtotal, service fee and guest payment method'
              : 'Субтотал проживания, сервисный сбор и способ оплаты гостя'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentModeToggle mode={paymentMode} onChange={setPaymentMode} disabled={loading} language={language} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subtotal">
                {language === 'en' ? `Subtotal, ${currency}` : `Субтотал, ${currency}`}
              </Label>
              <Input
                id="subtotal"
                type="number"
                min={100}
                step={currency === 'RUB' ? 100 : 50}
                value={subtotalDisplay}
                onChange={(e) => setSubtotalDisplay(e.target.value)}
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
            {language === 'en' ? 'Recalculate' : 'Пересчитать'}
          </Button>
        </CardContent>
      </Card>

      {isRubMode && result?.guestPaysRub != null ? (
        <Card className="border-amber-200/80 bg-amber-50/40">
          <CardContent className="py-4">
            <p className="text-sm text-amber-950">
              {language === 'en' ? 'Guest pays approximately ' : 'Гость заплатит примерно '}
              <strong className="tabular-nums">
                {formatNativeAmountInCurrency(result.guestPaysRub, 'RUB', language)}
              </strong>
              {result.fxMarkupPct ? (
                <span className="text-amber-900/80">
                  {' '}
                  {language === 'en'
                    ? `(includes operational FX markup ~${result.fxMarkupPct}% — it does not increase your bonus)`
                    : `(включая операционную FX-наценку ~${result.fxMarkupPct}% — она не увеличивает ваш бонус)`}
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <ResultTile
            icon={UserPlus}
            label={language === 'en' ? 'You (L1)' : 'Вы (L1)'}
            amountThb={result.l1AmountThb}
            hint={bonusMidHint}
            tone="brand"
            formatAmount={formatThbAsDisplay}
          />
          <ResultTile
            icon={Users}
            label={language === 'en' ? 'Mentor (L2)' : 'Наставник (L2)'}
            amountThb={result.l2AmountThb}
            hint={isRubMode ? bonusMidHint : l2Hint}
            tone="violet"
            formatAmount={formatThbAsDisplay}
          />
          <ResultTile
            icon={Gift}
            label={language === 'en' ? 'Friend (cashback)' : 'Друг (cashback)'}
            amountThb={result.refereeAmountThb}
            hint={
              isRubMode
                ? bonusMidHint
                : `${result.splitPercents?.referee ?? 43}% referral pool`
            }
            tone="teal"
            formatAmount={formatThbAsDisplay}
          />
        </div>
      ) : null}

      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="py-4 flex gap-3 text-sm text-slate-600">
          <Info className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
          <div className="space-y-2">
            <p>{result?.transparencyNote || result?.disclaimer || (language === 'en' ? 'Estimate before hold and payout.' : 'Оценка до hold и вывода.')}</p>
            <p>{result?.disclaimer}</p>
            <p>
              {language === 'en' ? 'Example: subtotal ' : 'Пример: при субтотале '}
              <strong>{exampleSubtotal}</strong>
              {language === 'en' ? ' and fee ' : ' и fee '}
              <strong>15%</strong>
              {language === 'en' ? ' — L1 ' : ' — L1 '}
              <strong>{exampleL1}</strong>, L2 <strong>{exampleL2}</strong>,{' '}
              {language === 'en' ? 'friend ' : 'друг '}
              <strong>{exampleFriend}</strong>{' '}
              {language === 'en' ? '(itemized waterfall, launch preset).' : '(itemized waterfall, launch preset).'}
            </p>
            {isAuthenticated ? (
              <Link href="/profile/referral" className="text-brand font-medium underline">
                {language === 'en' ? 'My referral hub →' : 'Мой реферальный кабинет →'}
              </Link>
            ) : (
              <Link href="/login?next=/about/referral" className="text-brand font-medium underline">
                {language === 'en' ? 'Sign in and get your link →' : 'Войти и получить ссылку →'}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
