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
import { Tag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_INSET_CLASS,
  MOBILE_FLAT_NESTED_PANEL_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'

export default function PartnerPromoPage() {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const t = useCallback((key, ctx) => getUIText(key, language, ctx), [language])

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
        toast.error(json.error || t('partnerPromo_flashExtendError'))
        return
      }
      toast.success(
        t('partnerPromo_flashExtendSuccess', {
          code: quickFlashCode,
          hours: quickExtendHours,
        }),
      )
      void loadPartnerPromos()
    } catch {
      toast.error(t('partnerPromo_flashExtendNetwork'))
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
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    )
  }

  if (!partnerId) {
    return (
      <section data-partner-section="promo-auth" className="mx-auto max-w-lg space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerPromo_authTitle')}</h2>
        <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS, 'sm:border-amber-200 sm:bg-amber-50/80')}>
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle className="sr-only">{t('partnerPromo_authTitle')}</CardTitle>
            <CardDescription>{t('partnerPromo_authBody')}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-0">
      <div className="mb-4">
        <h1
          className={cn(
            'flex items-center gap-2 text-2xl font-bold text-slate-900',
            PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS,
          )}
        >
          <Tag className="h-7 w-7 text-brand" />
          {t('partnerPromo_pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 md:mt-0">{t('partnerPromo_pageSubtitle')}</p>
      </div>

      {quickFlashCode ? (
        <>
          <section data-partner-section="promo-flash" className="space-y-3">
            <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerPromo_sectionFlash')}</h2>
            <Card
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                'sm:border-orange-200 sm:bg-orange-50/70',
              )}
            >
              <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
                <CardTitle className="sr-only">{t('partnerPromo_flashTelegramTitle')}</CardTitle>
                <CardDescription>
                  {t('partnerPromo_flashTelegramBody', { code: quickFlashCode })}
                </CardDescription>
              </CardHeader>
              <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
                <Button
                  onClick={handleQuickFlashExtend}
                  disabled={extendingFlashCode}
                  className="min-h-[44px] bg-orange-600 hover:bg-orange-700"
                >
                  {extendingFlashCode ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t('partnerPromo_flashExtendHours', { hours: quickExtendHours })}
                </Button>
              </CardContent>
            </Card>
          </section>
          <PartnerSectionDivider />
        </>
      ) : null}

      <section data-partner-section="promo-create" className="space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerPromo_sectionCreate')}</h2>
        <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle className="sr-only">{t('partnerPromo_formTitle')}</CardTitle>
            <CardDescription>{t('partnerPromo_scopeHint')}</CardDescription>
          </CardHeader>
          <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_fieldCode')}</Label>
                <Input
                  className="font-mono uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_fieldType')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">{t('partnerPromo_typePercent')}</SelectItem>
                    <SelectItem value="FIXED">{t('partnerPromo_typeFixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_fieldValue')}</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'PERCENT' ? '10' : '500'}
                />
              </div>
              <div
                className={cn(
                  MOBILE_FLAT_INSET_CLASS,
                  'flex items-start gap-3 sm:border-orange-100 sm:bg-orange-50/60',
                )}
              >
                <Checkbox
                  id="flash-sale"
                  checked={form.isFlashSale}
                  onCheckedChange={(v) => setForm({ ...form, isFlashSale: Boolean(v) })}
                />
                <div className="space-y-1">
                  <Label htmlFor="flash-sale" className={cn(PARTNER_FIELD_LABEL_CLASS, 'cursor-pointer text-orange-950')}>
                    {t('partnerPromo_flashSale')}
                  </Label>
                  <p className="text-xs leading-relaxed text-orange-900/85">
                    {t('partnerPromo_flashSaleHint')}
                  </p>
                </div>
              </div>

              {form.isFlashSale ? (
                <div className="space-y-1.5">
                  <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_flashEndsIn')}</Label>
                  <Select
                    value={String(form.flashEndsInHours)}
                    onValueChange={(v) => setForm({ ...form, flashEndsInHours: v })}
                  >
                    <SelectTrigger>
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
                <div className="space-y-1.5">
                  <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_fieldExpiry')}</Label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_fieldLimit')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="100"
                />
              </div>

              <div className={cn(MOBILE_FLAT_NESTED_PANEL_CLASS, 'sm:border-slate-200 sm:bg-slate-50/80')}>
                <p className={PARTNER_FIELD_LABEL_CLASS}>{t('partnerPromo_listingsSection')}</p>
                <p className="text-xs leading-relaxed text-slate-600">{t('partnerPromo_listingsHelp')}</p>
                {loadingListings ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('partnerPromo_loadingListings')}
                  </div>
                ) : listings.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('partnerPromo_noListings')}</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {listings.map((l) => (
                      <li
                        key={l.id}
                        className={cn(
                          MOBILE_FLAT_INSET_CLASS,
                          'flex items-start gap-3 sm:bg-white sm:px-2 sm:py-2',
                        )}
                      >
                        <Checkbox
                          id={`listing-${l.id}`}
                          checked={selectedListingIds.has(l.id)}
                          onCheckedChange={() => toggleListing(l.id)}
                        />
                        <label
                          htmlFor={`listing-${l.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm leading-snug"
                        >
                          <span className="line-clamp-2 font-medium text-slate-900">
                            {l.title || l.id}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">{l.status}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button type="submit" variant="brand" className="min-h-[44px] w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('partnerPromo_submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <PartnerSectionDivider />

      <section data-partner-section="promo-list" className="space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerPromo_sectionList')}</h2>
        <p className="text-xs leading-relaxed text-slate-500">{t('partnerPromo_listDesc')}</p>
        {loadingPromos ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('partnerPromo_loadingCodes')}
          </div>
        ) : promoCodes.length === 0 ? (
          <WorkspaceEmptyState
            icon={Tag}
            title={t('partnerPromo_emptyCodes')}
            hint={t('partnerPromo_listDesc')}
            className={PARTNER_HUB_LIST_CARD_SURFACE_CLASS}
            testId="partner-promo-empty"
          />
        ) : (
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
              <CardTitle className="sr-only">{t('partnerPromo_sectionList')}</CardTitle>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <div className="space-y-2">
                {promoCodes.map((promo) => {
                  const limitText =
                    promo.usageLimit == null
                      ? `${promo.usedCount}/∞`
                      : `${promo.usedCount}/${promo.usageLimit}`
                  return (
                    <div
                      key={promo.id}
                      className={cn(
                        MOBILE_FLAT_INSET_CLASS,
                        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:bg-white',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-900">{promo.code}</p>
                        <p className="text-xs text-slate-500">
                          {promo.type === 'PERCENT'
                            ? `${promo.value}%`
                            : formatPrice(promo.value, 'THB', { THB: 1 }, language)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">
                          {t('partnerPromo_badgeBookingsCreated', {
                            count: promo.bookingsCreatedCount || 0,
                          })}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t('partnerPromo_badgePaidCompleted', { used: limitText })}
                        </Badge>
                        {promo.isFlashSale ? (
                          <Badge className="border-0 bg-gradient-to-r from-orange-500 to-rose-500 text-xs text-white">
                            FLASH
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
