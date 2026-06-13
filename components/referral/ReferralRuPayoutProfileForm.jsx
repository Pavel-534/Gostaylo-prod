'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Loader2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import {
  validateRuInnField,
  validateRuBikField,
  validateRuAccountField,
  digitsOnly,
} from '@/lib/referral/validate-ru-inn.js'

function fieldErrors(form, t) {
  const recipient = String(form.recipientName || '').trim()
  const innErrKey = validateRuInnField(form.inn)
  const innErr = innErrKey ? t(innErrKey) : null
  const bikErrKey = validateRuBikField(form.bik)
  const bikErr = bikErrKey ? t(bikErrKey) : null
  const accountErrKey = validateRuAccountField(form.accountNumber)
  const accountErr = accountErrKey ? t(accountErrKey) : null
  const recipientErr = recipient && recipient.length < 3 ? t('stage1322_ruProfileErrRecipient') : null
  return {
    recipientName: recipientErr,
    inn: innErr,
    bik: bikErr,
    accountNumber: accountErr,
  }
}

/**
 * Stage 131.5 / 132.2 — gate: RU bank profile before referral withdrawal request.
 */
export function ReferralRuPayoutProfileForm({ onReady, className = '' }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
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

  const errors = useMemo(() => fieldErrors(form, t), [form, t])
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
      toast.error(t('stage1322_ruProfileFixErrors'))
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
        throw new Error(json?.error || t('stage1322_ruProfileSaveErr'))
      }
      toast.success(t('stage1322_ruProfileSaveOk'))
      setReady(true)
      onReady?.(true)
    } catch (err) {
      toast.error(err?.message || t('stage1322_ruProfileSaveErr'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 py-4 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('stage1322_ruProfileLoading')}
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
          <p className="font-medium">{t('stage1322_ruProfileReadyTitle')}</p>
          <p className="text-emerald-900/80 mt-0.5 text-xs leading-relaxed">
            {verified ? t('stage1322_ruProfileReadyVerified') : t('stage1322_ruProfileReadyPending')}
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
          {t('stage1322_ruProfileTitle')}
        </CardTitle>
        <CardDescription>{t('stage1322_ruProfileDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">{t('stage1322_ruProfileModeration')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ref-recipient">{t('stage1322_ruProfileRecipientLabel')}</Label>
              <Input
                id="ref-recipient"
                required
                value={form.recipientName}
                onChange={(e) => setForm((p) => ({ ...p, recipientName: e.target.value }))}
                onBlur={() => markTouched('recipientName')}
                placeholder={t('stage1322_ruProfileRecipientPlaceholder')}
                aria-invalid={touched.recipientName && !!errors.recipientName}
              />
              {touched.recipientName && errors.recipientName ? (
                <p className="text-xs text-rose-600">{errors.recipientName}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-inn">{t('stage1322_ruProfileInnLabel')}</Label>
              <Input
                id="ref-inn"
                required
                inputMode="numeric"
                value={form.inn}
                onChange={(e) => setForm((p) => ({ ...p, inn: e.target.value }))}
                onBlur={() => markTouched('inn')}
                placeholder={t('stage1322_ruProfileInnPlaceholder')}
                aria-invalid={touched.inn && !!errors.inn}
              />
              {touched.inn && errors.inn ? <p className="text-xs text-rose-600">{errors.inn}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-bik">{t('stage1322_ruProfileBikLabel')}</Label>
              <Input
                id="ref-bik"
                required
                inputMode="numeric"
                value={form.bik}
                onChange={(e) => setForm((p) => ({ ...p, bik: e.target.value }))}
                onBlur={() => markTouched('bik')}
                placeholder={t('stage1322_ruProfileBikPlaceholder')}
                aria-invalid={touched.bik && !!errors.bik}
              />
              {touched.bik && errors.bik ? <p className="text-xs text-rose-600">{errors.bik}</p> : null}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ref-account">{t('stage1322_ruProfileAccountLabel')}</Label>
              <Input
                id="ref-account"
                required
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
                onBlur={() => markTouched('accountNumber')}
                placeholder={t('stage1322_ruProfileAccountPlaceholder')}
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
                {t('stage1322_ruProfileSaving')}
              </>
            ) : (
              t('stage1322_ruProfileSaveBtn')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default ReferralRuPayoutProfileForm
