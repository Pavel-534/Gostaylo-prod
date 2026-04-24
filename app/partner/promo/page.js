'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tag, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'

export default function PartnerPromoPage() {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const t = useCallback((key) => getUIText(key, language), [language])

  const [partnerId, setPartnerId] = useState(null)
  const [listings, setListings] = useState([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingListings, setLoadingListings] = useState(false)
  const [loadingPromos, setLoadingPromos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedListingIds, setSelectedListingIds] = useState(() => new Set())
  const [promoCodes, setPromoCodes] = useState([])
  const [extendingFlashCode, setExtendingFlashCode] = useState(false)

  const [form, setForm] = useState({
    code: '',
    type: 'PERCENT',
    value: '',
    expiryDate: '',
    usageLimit: '',
    isFlashSale: false,
    flashEndsInHours: '24',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingSession(true)
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success || !json.user?.id) {
          if (!cancelled) setPartnerId(null)
          return
        }
        if (!cancelled) setPartnerId(String(json.user.id))
      } catch {
        if (!cancelled) setPartnerId(null)
      } finally {
        if (!cancelled) setLoadingSession(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    async function loadListings() {
      setLoadingListings(true)
      try {
        const res = await fetch(`/api/v2/partner/listings?partnerId=${encodeURIComponent(partnerId)}`, {
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          if (!cancelled) setListings([])
          return
        }
        if (!cancelled) setListings(Array.isArray(json.data) ? json.data : [])
      } catch {
        if (!cancelled) setListings([])
      } finally {
        if (!cancelled) setLoadingListings(false)
      }
    }
    void loadListings()
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const loadPartnerPromos = useCallback(async () => {
    if (!partnerId) return
    setLoadingPromos(true)
    try {
      const res = await fetch('/api/v2/partner/promo-codes', {
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setPromoCodes([])
        return
      }
      setPromoCodes(Array.isArray(json.data) ? json.data : [])
    } catch {
      setPromoCodes([])
    } finally {
      setLoadingPromos(false)
    }
  }, [partnerId])

  const quickFlashCode = String(searchParams.get('flashCode') || '')
    .trim()
    .toUpperCase()
  const quickExtendHoursRaw = Number(searchParams.get('extendHours') || 6)
  const quickExtendHours =
    Number.isFinite(quickExtendHoursRaw) && quickExtendHoursRaw > 0
      ? Math.min(24, Math.max(1, Math.round(quickExtendHoursRaw)))
      : 6

  const handleQuickFlashExtend = async () => {
    if (!quickFlashCode) return
    setExtendingFlashCode(true)
    try {
      const res = await fetch(
        `/api/v2/partner/promo-codes/${encodeURIComponent(quickFlashCode)}/extend-flash-sale`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hours: quickExtendHours,
            extensionSource: 'telegram_deeplink',
          }),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось продлить Flash Sale')
        return
      }
      toast.success(`Flash Sale ${quickFlashCode} продлен на ${quickExtendHours} ч`)
      void loadPartnerPromos()
    } catch {
      toast.error('Ошибка сети при продлении Flash Sale')
    } finally {
      setExtendingFlashCode(false)
    }
  }

  useEffect(() => {
    void loadPartnerPromos()
  }, [loadPartnerPromos])

  const toggleListing = (id) => {
    setSelectedListingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.code || !form.value || !form.usageLimit) {
      toast.error(t('partnerPromo_fillAll'))
      return
    }
    if (!form.isFlashSale && !form.expiryDate) {
      toast.error(t('partnerPromo_fillAll'))
      return
    }
    if (form.isFlashSale && !['3', '6', '12', '24'].includes(String(form.flashEndsInHours))) {
      toast.error(t('partnerPromo_flashNeedsDuration'))
      return
    }
    setSubmitting(true)
    try {
      const listingIds = selectedListingIds.size > 0 ? [...selectedListingIds] : undefined
      const res = await fetch('/api/v2/partner/promo-codes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: form.value,
          ...(form.isFlashSale
            ? { isFlashSale: true, flashEndsInHours: Number(form.flashEndsInHours) }
            : { expiryDate: form.expiryDate }),
          usageLimit: form.usageLimit,
          ...(listingIds ? { listingIds } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        toast.success(t('partnerPromo_success'))
        setForm({
          code: '',
          type: 'PERCENT',
          value: '',
          expiryDate: '',
          usageLimit: '',
          isFlashSale: false,
          flashEndsInHours: '24',
        })
        setSelectedListingIds(new Set())
        void loadPartnerPromos()
      } else {
        toast.error(json.error || t('partnerPromo_error'))
      }
    } catch {
      toast.error(t('partnerPromo_error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!partnerId) {
    return (
      <Card className="max-w-lg border-amber-200 bg-amber-50/80">
        <CardHeader>
          <CardTitle>{t('partnerPromo_authTitle')}</CardTitle>
          <CardDescription>{t('partnerPromo_authBody')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-slate-600">
        <Link href="/partner/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('partnerPromo_backDashboard')}
        </Link>
      </Button>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Tag className="h-7 w-7 text-teal-600" />
          {t('partnerPromo_pageTitle')}
        </h1>
        <p className="mt-1 text-slate-600">{t('partnerPromo_pageSubtitle')}</p>
      </div>

      {quickFlashCode ? (
        <Card className="border-orange-200 bg-orange-50/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flash Sale из Telegram</CardTitle>
            <CardDescription>
              Код <span className="font-mono">{quickFlashCode}</span>. Быстрое действие для продления акции.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleQuickFlashExtend}
              disabled={extendingFlashCode}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {extendingFlashCode ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Продлить на {quickExtendHours} часов
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('partnerPromo_formTitle')}</CardTitle>
          <CardDescription>{t('partnerPromo_scopeHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('partnerPromo_fieldCode')}</Label>
              <Input
                className="mt-2 font-mono uppercase"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER2026"
              />
            </div>
            <div>
              <Label>{t('partnerPromo_fieldType')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">{t('partnerPromo_typePercent')}</SelectItem>
                  <SelectItem value="FIXED">{t('partnerPromo_typeFixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('partnerPromo_fieldValue')}</Label>
              <Input
                type="number"
                className="mt-2"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'PERCENT' ? '10' : '500'}
              />
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50/60 p-3">
              <Checkbox
                id="flash-sale"
                checked={form.isFlashSale}
                onCheckedChange={(v) => setForm({ ...form, isFlashSale: Boolean(v) })}
              />
              <div className="space-y-1">
                <Label htmlFor="flash-sale" className="cursor-pointer font-medium text-orange-950">
                  {t('partnerPromo_flashSale')}
                </Label>
                <p className="text-xs text-orange-900/85 leading-relaxed">{t('partnerPromo_flashSaleHint')}</p>
              </div>
            </div>

            {form.isFlashSale ? (
              <div>
                <Label>{t('partnerPromo_flashEndsIn')}</Label>
                <Select
                  value={String(form.flashEndsInHours)}
                  onValueChange={(v) => setForm({ ...form, flashEndsInHours: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">{t('partnerPromo_flashHours3')}</SelectItem>
                    <SelectItem value="6">{t('partnerPromo_flashHours6')}</SelectItem>
                    <SelectItem value="12">{t('partnerPromo_flashHours12')}</SelectItem>
                    <SelectItem value="24">{t('partnerPromo_flashHours24')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>{t('partnerPromo_fieldExpiry')}</Label>
                <Input
                  type="date"
                  className="mt-2"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>{t('partnerPromo_fieldLimit')}</Label>
              <Input
                type="number"
                min={1}
                className="mt-2"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="100"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">{t('partnerPromo_listingsSection')}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{t('partnerPromo_listingsHelp')}</p>
              {loadingListings ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('partnerPromo_loadingListings')}
                </div>
              ) : listings.length === 0 ? (
                <p className="text-sm text-slate-500">{t('partnerPromo_noListings')}</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {listings.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 rounded-md bg-white px-2 py-2 border border-slate-100">
                      <Checkbox
                        id={`listing-${l.id}`}
                        checked={selectedListingIds.has(l.id)}
                        onCheckedChange={() => toggleListing(l.id)}
                      />
                      <label htmlFor={`listing-${l.id}`} className="text-sm leading-snug cursor-pointer flex-1 min-w-0">
                        <span className="font-medium text-slate-900 line-clamp-2">{l.title || l.id}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{l.status}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('partnerPromo_submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Мои промокоды</CardTitle>
          <CardDescription>Воронка эффективности: созданные брони vs оплаченные/завершенные.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPromos ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка промокодов...
            </div>
          ) : promoCodes.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет промокодов. Создайте первый код выше.</p>
          ) : (
            <div className="space-y-2">
              {promoCodes.map((promo) => {
                const limitText =
                  promo.usageLimit == null
                    ? `${promo.usedCount}/∞`
                    : `${promo.usedCount}/${promo.usageLimit}`
                return (
                  <div
                    key={promo.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-900">{promo.code}</p>
                      <p className="text-xs text-slate-500">
                        {promo.type === 'PERCENT' ? `${promo.value}%` : `${promo.value} THB`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        Создано броней: {promo.bookingsCreatedCount || 0}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Оплачено/завершено: {limitText}
                      </Badge>
                      {promo.isFlashSale ? (
                        <Badge className="text-xs border-0 bg-gradient-to-r from-orange-500 to-rose-500 text-white">
                          FLASH
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
