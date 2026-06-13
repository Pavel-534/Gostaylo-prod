'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Loader2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  validateRuInnField,
  validateRuBik,
  validateRuAccountNumber,
  digitsOnly,
} from '@/lib/referral/validate-ru-inn.js'

const MODERATION_NOTICE =
  'После сохранения реквизиты проверяет модератор. ФИО, БИК, ИНН и номер счёта должны совпадать с банковскими данными — иначе выплата задержится.'

function fieldErrors(form) {
  const recipient = String(form.recipientName || '').trim()
  const innErr = validateRuInnField(form.inn)
  const bik = digitsOnly(form.bik)
  const account = digitsOnly(form.accountNumber)
  const bikErr = bik && !validateRuBik(bik) ? 'БИК — 9 цифр' : null
  const accountErr =
    account && !validateRuAccountNumber(account)
      ? 'Номер счёта — 20 цифр (или 16–20 для карты)'
      : null
  const recipientErr = recipient && recipient.length < 3 ? 'Укажите ФИО как в банке' : null
  return {
    recipientName: recipientErr,
    inn: innErr,
    bik: bikErr,
    accountNumber: accountErr,
  }
}

/**
 * Stage 131.5 / 132.0 — gate: RU bank profile before referral withdrawal request.
 */
export function ReferralRuPayoutProfileForm({ onReady, className = '' }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [verified, setVerified] = useState(false)
  const [touched, setTouched] = useState({})
  const [form, setForm] = useState({
    recipientName: '',
    inn: '',
    bik: '',
    accountNumber: '',
  })

  const errors = useMemo(() => fieldErrors(form), [form])
  const hasBlockingErrors = useMemo(() => {
    const recipient = String(form.recipientName || '').trim()
    const inn = digitsOnly(form.inn)
    const bik = digitsOnly(form.bik)
    const account = digitsOnly(form.accountNumber)
    if (!recipient || !inn || !bik || !account) return true
    return Object.values(errors).some(Boolean)
  }, [form, errors])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v2/wallet/referral-payout-profile', {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.success && json?.data?.ready) {
        setReady(true)
        setVerified(json.data?.profile?.isVerified === true)
        onReady?.(true)
      } else {
        setReady(false)
        onReady?.(false)
      }
    } catch {
      setReady(false)
      onReady?.(false)
    } finally {
      setLoading(false)
    }
  }, [onReady])

  useEffect(() => {
    void load()
  }, [load])

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setTouched({ recipientName: true, inn: true, bik: true, accountNumber: true })
    if (hasBlockingErrors) {
      toast.error('Исправьте ошибки в реквизитах')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/v2/wallet/referral-payout-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Не удалось сохранить реквизиты')
      }
      toast.success('Реквизиты сохранены — можно отправить заявку на вывод')
      setReady(true)
      onReady?.(true)
    } catch (err) {
      toast.error(err?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 py-4 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Проверяем реквизиты…
      </div>
    )
  }

  if (ready) {
    return (
      <div
        id="ru-payout-profile"
        className={`rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 flex gap-3 ${className}`}
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-medium">Карта / счёт РФ привязаны</p>
          <p className="text-emerald-900/80 mt-0.5 text-xs leading-relaxed">
            {verified
              ? 'Реквизиты подтверждены модератором — выплата пойдёт в единый реестр Т-Банка.'
              : 'Реквизиты на проверке. Вывод в рублях — только на карты РФ по mid-курсу (спред 0%).'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card id="ru-payout-profile" className={`rounded-2xl border border-brand/20 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Landmark className="h-5 w-5 text-brand" aria-hidden />
          Реквизиты для вывода в рублях
        </CardTitle>
        <CardDescription>
          Вывод амбассадорских бонусов — только на карты и счета РФ. Баланс хранится в THB; при
          выплате конвертируем по mid-курсу без спреда платформы.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">{MODERATION_NOTICE}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ref-recipient">ФИО получателя (как в банке)</Label>
              <Input
                id="ref-recipient"
                required
                value={form.recipientName}
                onChange={(e) => setForm((p) => ({ ...p, recipientName: e.target.value }))}
                onBlur={() => markTouched('recipientName')}
                placeholder="Иванов Иван Иванович"
                aria-invalid={touched.recipientName && !!errors.recipientName}
              />
              {touched.recipientName && errors.recipientName ? (
                <p className="text-xs text-rose-600">{errors.recipientName}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-inn">ИНН</Label>
              <Input
                id="ref-inn"
                required
                inputMode="numeric"
                value={form.inn}
                onChange={(e) => setForm((p) => ({ ...p, inn: e.target.value }))}
                onBlur={() => markTouched('inn')}
                placeholder="10 или 12 цифр"
                aria-invalid={touched.inn && !!errors.inn}
              />
              {touched.inn && errors.inn ? <p className="text-xs text-rose-600">{errors.inn}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-bik">БИК</Label>
              <Input
                id="ref-bik"
                required
                inputMode="numeric"
                value={form.bik}
                onChange={(e) => setForm((p) => ({ ...p, bik: e.target.value }))}
                onBlur={() => markTouched('bik')}
                placeholder="9 цифр"
                aria-invalid={touched.bik && !!errors.bik}
              />
              {touched.bik && errors.bik ? <p className="text-xs text-rose-600">{errors.bik}</p> : null}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ref-account">Расчётный счёт или номер карты</Label>
              <Input
                id="ref-account"
                required
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
                onBlur={() => markTouched('accountNumber')}
                placeholder="20 цифр счёта"
                aria-invalid={touched.accountNumber && !!errors.accountNumber}
              />
              {touched.accountNumber && errors.accountNumber ? (
                <p className="text-xs text-rose-600">{errors.accountNumber}</p>
              ) : null}
            </div>
          </div>
          <Button type="submit" variant="brand" disabled={saving || hasBlockingErrors} className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                Сохраняем…
              </>
            ) : (
              'Сохранить реквизиты'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default ReferralRuPayoutProfileForm
