'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { toast } from 'sonner'
import { ProxiedImage } from '@/components/proxied-image'
import { 
  CheckCircle, XCircle, Loader2, Building2, User, Clock, 
  AlertTriangle, MapPin, DollarSign, Percent,
  X, Sparkles, ExternalLink, Phone, Mail, Pencil, Filter, Navigation
} from 'lucide-react'
import {
  formatListingCoordinates,
  formatModerationPartnerLabel,
  formatModerationCreatedAt,
  truncateModerationDescription,
} from '@/lib/admin/moderation-queue.js'
import { useI18n } from '@/contexts/i18n-context'
import { getCategoryName } from '@/lib/translations'
import { resolveCategoryDisplayName } from '@/lib/category-display-name'

export default function ModerationPage() {
  const { language } = useI18n()
  const [pendingListings, setPendingListings] = useState([])
  const [totalPending, setTotalPending] = useState(0)
  const [facets, setFacets] = useState({ partners: [], categories: [] })
  const [filters, setFilters] = useState({
    partner: '',
    category: '',
    dateFrom: '',
    dateTo: '',
  })
  const [loading, setLoading] = useState(true)
  const [selectedListing, setSelectedListing] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingListing, setRejectingListing] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const processing = processingId != null
  const [editTextMode, setEditTextMode] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftDistrict, setDraftDistrict] = useState('')
  const [draftPrice, setDraftPrice] = useState('')

  useEffect(() => {
    loadData()
  }, [filters.partner, filters.category, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    if (!selectedListing) return
    setEditTextMode(false)
    setDraftTitle(selectedListing.title ?? '')
    setDraftDescription(selectedListing.description ?? '')
    setDraftDistrict(selectedListing.district ?? '')
    setDraftPrice(
      selectedListing.base_price_thb != null && selectedListing.base_price_thb !== ''
        ? String(selectedListing.base_price_thb)
        : '',
    )
  }, [selectedListing?.id])

  async function loadData() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.partner.trim()) params.set('partner', filters.partner.trim())
      if (filters.category) params.set('category', filters.category)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const qs = params.toString()
      const res = await fetch(`/api/admin/moderation${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      
      if (data.success) {
        setPendingListings(data.listings || [])
        setTotalPending(data.totalPending ?? data.listings?.length ?? 0)
        if (data.facets) setFacets(data.facets)
      } else {
        throw new Error(data.error || 'Failed to load')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    setFilters({ partner: '', category: '', dateFrom: '', dateTo: '' })
  }

  const coords = selectedListing
    ? formatListingCoordinates(selectedListing.latitude, selectedListing.longitude)
    : null

  function categoryLabel(cat) {
    if (!cat) return ''
    return resolveCategoryDisplayName(cat, language, getCategoryName) || cat.name || cat.slug || ''
  }

  async function revalidateListingsCache(listingId) {
    try {
      await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: ['/', '/listings', listingId ? `/listings/${listingId}` : null].filter(Boolean),
        }),
      })
    } catch {
      // non-blocking
    }
  }

  async function handleApproveListing(listingId, overrides = {}) {
    const titleTrim = String(overrides.title ?? draftTitle ?? '').trim()
    const description = overrides.description ?? draftDescription ?? ''
    const district = overrides.district ?? draftDistrict ?? ''
    const basePriceThb =
      overrides.basePriceThb !== undefined
        ? overrides.basePriceThb
        : draftPrice !== ''
          ? Number(draftPrice)
          : undefined
    if (!titleTrim) {
      toast.error('Укажите заголовок объявления')
      return
    }
    if (basePriceThb !== undefined && (!Number.isFinite(basePriceThb) || basePriceThb < 0)) {
      toast.error('Укажите корректную цену')
      return
    }

    setProcessingId(listingId)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          action: 'approve',
          title: titleTrim,
          description,
          district,
          ...(basePriceThb !== undefined ? { basePriceThb } : {}),
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        await revalidateListingsCache(listingId)
        toast.success(
          data.notificationSent
            ? 'Одобрено — объявление в каталоге и поиске. Партнёр уведомлён в Telegram.'
            : 'Одобрено — объявление в каталоге и поиске.',
        )
        setSelectedListing(null)
        loadData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Не удалось одобрить объявление')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleSaveListingEdits() {
    if (!selectedListing) return
    const titleTrim = String(draftTitle ?? '').trim()
    if (!titleTrim) {
      toast.error('Укажите заголовок объявления')
      return
    }
    const priceNum = draftPrice !== '' ? Number(draftPrice) : undefined
    if (priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum < 0)) {
      toast.error('Укажите корректную цену')
      return
    }

    setProcessingId(selectedListing.id)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          action: 'update',
          title: titleTrim,
          description: draftDescription ?? '',
          district: draftDistrict ?? '',
          ...(priceNum !== undefined ? { basePriceThb: priceNum } : {}),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      const next = {
        ...selectedListing,
        title: data.title ?? titleTrim,
        description: data.description ?? draftDescription,
        district: data.district ?? draftDistrict,
        base_price_thb:
          data.base_price_thb !== undefined ? data.base_price_thb : selectedListing.base_price_thb,
      }
      setSelectedListing(next)
      setPendingListings((prev) => prev.map((l) => (l.id === next.id ? { ...l, ...next } : l)))
      setEditTextMode(false)
      toast.success('Правки сохранены — объявление остаётся на проверке')
    } catch {
      toast.error('Не удалось сохранить правки')
    } finally {
      setProcessingId(null)
    }
  }

  async function openRejectModal(listing, e) {
    e?.stopPropagation?.()
    setRejectingListing(listing)
    setRejectReason('')
    setShowRejectModal(true)
  }

  function onListApprove(listing, e) {
    e.stopPropagation()
    void handleApproveListing(listing.id, {
      title: listing.title,
      description: listing.description ?? '',
      district: listing.district ?? '',
      basePriceThb: listing.base_price_thb,
    })
  }

  async function handleRejectListing() {
    if (!rejectingListing || !rejectReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }

    setProcessingId(rejectingListing.id)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          listingId: rejectingListing.id, 
          action: 'reject',
          rejectReason 
        })
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(data.notificationSent 
          ? 'Объявление отклонено! Партнёр уведомлён в Telegram'
          : 'Объявление отклонено'
        )
        setShowRejectModal(false)
        setSelectedListing(null)
        setRejectingListing(null)
        loadData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Не удалось отклонить объявление')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleToggleFeatured(listingId, isFeatured) {
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          action: 'set_featured',
          isFeatured,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed')
      }

      setPendingListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, is_featured: isFeatured } : l)),
      )
      if (selectedListing?.id === listingId) {
        setSelectedListing({ ...selectedListing, is_featured: isFeatured })
      }
      toast.success(isFeatured ? 'Добавлено в рекомендации' : 'Убрано из рекомендаций')
    } catch (error) {
      console.error(error)
      toast.error('Не удалось обновить «Рекомендуем»')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Модерация объявлений</h1>
        <p className="text-slate-600 mt-1">Проверка новых объявлений перед публикацией</p>
      </div>

      {/* Stats */}
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-600">{pendingListings.length}</p>
              <p className="text-sm text-slate-600">
                {pendingListings.length !== totalPending
                  ? `Показано из ${totalPending} на модерации`
                  : 'Ожидают проверки'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter className="h-4 w-4" />
            Фильтры
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="mod-filter-partner" className="text-xs text-slate-500">
                Партнёр
              </Label>
              <Input
                id="mod-filter-partner"
                placeholder="Имя, email, id…"
                value={filters.partner}
                onChange={(e) => setFilters((f) => ({ ...f, partner: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mod-filter-category" className="text-xs text-slate-500">
                Категория
              </Label>
              <select
                id="mod-filter-category"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Все</option>
                {facets.categories?.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {categoryLabel(c)} ({c.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="mod-filter-from" className="text-xs text-slate-500">
                Создано с
              </Label>
              <Input
                id="mod-filter-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mod-filter-to" className="text-xs text-slate-500">
                по
              </Label>
              <Input
                id="mod-filter-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
                Сбросить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Grid */}
      {pendingListings.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Всё проверено!</h3>
            <p className="text-slate-600">Нет объявлений на модерации</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingListings.map((listing) => (
            <Card
              key={listing.id}
              className="overflow-hidden border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedListing(listing)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-44 md:w-52 shrink-0 aspect-[4/3] sm:aspect-auto sm:min-h-[140px] bg-slate-100">
                    {listing.images?.[0] ? (
                      <ProxiedImage
                        src={listing.images[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        sizes="208px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building2 className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-orange-500 text-[10px]">
                      На проверке
                    </Badge>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="font-semibold text-slate-900 line-clamp-1 text-base md:text-lg">
                        {listing.title || 'Без названия'}
                      </h3>
                      {truncateModerationDescription(listing.description) ? (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {truncateModerationDescription(listing.description)}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-700">Нет описания</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {formatModerationPartnerLabel(listing)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatModerationCreatedAt(listing.created_at)}
                        </span>
                        {listing.categories ? (
                          <span>{categoryLabel(listing.categories)}</span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {listing.district || '—'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-indigo-700">
                        ฿{listing.base_price_thb?.toLocaleString() || 0}/день · {listing.effectiveCommission}%
                        комиссия
                      </p>
                    </div>

                    <div
                      className="flex shrink-0 flex-col gap-2 sm:w-[200px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="lg"
                        className="h-12 w-full bg-green-600 hover:bg-green-700 text-base font-semibold shadow-sm"
                        disabled={processingId != null}
                        onClick={(e) => onListApprove(listing, e)}
                      >
                        {processingId === listing.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Одобрить
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="destructive"
                        className="h-12 w-full text-base font-semibold shadow-sm"
                        disabled={processing}
                        onClick={(e) => openRejectModal(listing, e)}
                      >
                        <XCircle className="h-5 w-5 mr-2" />
                        Отклонить
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-slate-600"
                        onClick={() => setSelectedListing(listing)}
                      >
                        Подробнее
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed View Modal — Stage 200.24: wide dialog + scroll body + sticky footer */}
      <Dialog
        open={!!selectedListing}
        onOpenChange={(open) => {
          if (!open) setSelectedListing(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(95vh,calc(100dvh-1rem))] w-full max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          {selectedListing && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {/* Image Carousel */}
              <div className="relative bg-slate-900">
                {selectedListing.images?.length > 0 ? (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {selectedListing.images.map((img, idx) => (
                        <CarouselItem key={idx}>
                          <div className="relative aspect-[16/10] md:aspect-[16/9]">
                            <ProxiedImage
                              src={img}
                              alt={`Фото ${idx + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 1024px) 100vw, 896px"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 bg-white/90 hover:bg-white z-10" />
                    <CarouselNext className="right-14 bg-white/90 hover:bg-white z-10" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full z-10">
                      {selectedListing.images.length} фото
                    </div>
                  </Carousel>
                ) : (
                  <div className="aspect-[16/10] bg-slate-200 flex items-center justify-center">
                    <Building2 className="h-16 w-16 text-slate-400" />
                  </div>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] rounded-full bg-white/90 shadow-lg hover:bg-white"
                  onClick={() => setSelectedListing(null)}
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="space-y-4 p-4 md:p-6">
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1 space-y-2">
                    {editTextMode ? (
                      <div>
                        <Label htmlFor="mod-title" className="text-xs text-slate-500">
                          Заголовок
                        </Label>
                        <Input
                          id="mod-title"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="mt-1 font-semibold text-base md:text-lg"
                          maxLength={255}
                        />
                      </div>
                    ) : (
                      <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                        {selectedListing.title || 'Без названия'}
                      </h2>
                    )}
                    {editTextMode ? (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="mod-district" className="text-xs text-slate-500">
                            Район
                          </Label>
                          <Input
                            id="mod-district"
                            value={draftDistrict}
                            onChange={(e) => setDraftDistrict(e.target.value)}
                            className="mt-1"
                            maxLength={200}
                            placeholder="Район"
                          />
                        </div>
                        {selectedListing.categories ? (
                          <p className="text-slate-600 text-sm">
                            {categoryLabel(selectedListing.categories)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-slate-600 flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {selectedListing.district || 'Район не указан'}
                        {selectedListing.categories
                          ? ` · ${categoryLabel(selectedListing.categories)}`
                          : ''}
                      </p>
                    )}
                    {coords ? (
                      <p className="text-sm text-slate-600 flex items-center gap-2 mt-1 flex-wrap">
                        <Navigation className="h-4 w-4 shrink-0 text-indigo-600" />
                        <span className="font-mono text-xs">{coords.label}</span>
                        <a
                          href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 text-xs underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Карта
                        </a>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-1">Координаты не указаны</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!editTextMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] text-slate-700"
                          onClick={() => setEditTextMode(true)}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          Править объявление
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => {
                            setDraftTitle(selectedListing.title ?? '')
                            setDraftDescription(selectedListing.description ?? '')
                            setDraftDistrict(selectedListing.district ?? '')
                            setDraftPrice(
                              selectedListing.base_price_thb != null &&
                                selectedListing.base_price_thb !== ''
                                ? String(selectedListing.base_price_thb)
                                : '',
                            )
                            setEditTextMode(false)
                          }}
                        >
                          Сбросить правки
                        </Button>
                      )}
                    </div>
                    {editTextMode ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                        Можно править заголовок, описание, район и цену. «Сохранить правки» оставляет
                        статус «На проверке»; «Одобрить» публикует с текущими значениями. Фото здесь
                        не меняются — при необходимости отклоните или попросите партнёра обновить
                        объявление.
                      </p>
                    ) : null}
                  </div>
                  <Badge className="bg-orange-500 shrink-0">На проверке</Badge>
                </div>

                {/* Owner Card */}
                <Card className="border-2 border-indigo-200 bg-indigo-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {selectedListing.owner?.first_name || ''} {selectedListing.owner?.last_name || ''}
                          </p>
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedListing.owner?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedListing.owner?.phone && (
                          <a 
                            href={`tel:${selectedListing.owner.phone}`}
                            className="text-sm text-slate-600 flex items-center gap-1 hover:text-indigo-600"
                          >
                            <Phone className="h-3 w-3" />
                            {selectedListing.owner.phone}
                          </a>
                        )}
                        <Link 
                          href={`/admin/users/${selectedListing.owner_id}`}
                          className="text-indigo-600 hover:text-indigo-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm" className="text-indigo-600">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Профиль
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Цена</span>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-indigo-700">
                      {editTextMode ? (
                        <span className="flex items-center gap-1">
                          <span className="text-base font-semibold">฿</span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(e.target.value)}
                            className="h-9 max-w-[9rem] bg-white text-base font-bold"
                            aria-label="Цена в батах"
                          />
                        </span>
                      ) : (
                        <>฿{selectedListing.base_price_thb?.toLocaleString() || 0}</>
                      )}
                    </p>
                    <p className="text-xs text-indigo-600">/день</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="text-xs font-medium">Комиссия</span>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-green-700">
                      {selectedListing.effectiveCommission}%
                    </p>
                    <p className="text-xs text-green-600">
                      {selectedListing.owner?.custom_commission_rate 
                        ? 'персональная' 
                        : `системная (${selectedListing.systemCommission}%)`
                      }
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Создано</span>
                    </div>
                    <p className="text-sm md:text-base font-bold text-purple-700">
                      {selectedListing.created_at 
                        ? new Date(selectedListing.created_at).toLocaleDateString('ru-RU')
                        : '-'}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-medium">Рекомендуем</span>
                      </div>
                      <Switch
                        checked={selectedListing.is_featured || false}
                        onCheckedChange={(checked) => {
                          handleToggleFeatured(selectedListing.id, checked)
                        }}
                        className="data-[state=checked]:bg-amber-500"
                      />
                    </div>
                    <p className="text-sm font-bold text-amber-700">
                      {selectedListing.is_featured ? 'Да' : 'Нет'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {(editTextMode || selectedListing.description) && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">Описание</h3>
                    {editTextMode ? (
                      <>
                        <Label htmlFor="mod-desc" className="sr-only">
                          Описание
                        </Label>
                        <Textarea
                          id="mod-desc"
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                          className="min-h-[200px] text-sm text-slate-700"
                          maxLength={50000}
                        />
                      </>
                    ) : (
                      <p className="text-slate-600 text-sm whitespace-pre-wrap">
                        {selectedListing.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
              </div>

              {/* Sticky footer outside scroll */}
              <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-3 sm:flex-row sm:gap-3 sm:p-4">
                {editTextMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSaveListingEdits()}
                    className="min-h-[44px] h-12 flex-1 text-base font-semibold sm:h-14 sm:text-lg"
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    ) : (
                      <Pencil className="h-5 w-5 mr-2" />
                    )}
                    Сохранить правки
                  </Button>
                ) : null}
                <Button
                  onClick={() => handleApproveListing(selectedListing.id)}
                  variant="brand"
                  className="min-h-[44px] h-12 flex-1 text-base font-semibold shadow-md sm:h-14 sm:text-lg"
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-6 w-6 mr-2" />
                  )}
                  Одобрить и опубликовать
                </Button>

                <Button
                  onClick={() => openRejectModal(selectedListing)}
                  variant="destructive"
                  className="min-h-[44px] h-12 flex-1 text-base font-semibold shadow-md sm:h-14 sm:text-lg"
                  disabled={processing}
                >
                  <XCircle className="h-6 w-6 mr-2" />
                  Отклонить
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Отклонение объявления
            </DialogTitle>
            <DialogDescription>
              Укажите причину отклонения. Партнёр получит уведомление в Telegram.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejectReason">Причина отклонения *</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Опишите, что нужно исправить..."
                className="mt-2 min-h-[120px]"
              />
            </div>
            
            {/* Quick reasons */}
            <div className="flex flex-wrap gap-2">
              {[
                'Некачественные фото',
                'Неполное описание',
                'Неверная цена',
                'Дубликат объявления'
              ].map(reason => (
                <Badge 
                  key={reason}
                  variant="outline" 
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => setRejectReason(prev => prev ? `${prev}\n• ${reason}` : `• ${reason}`)}
                >
                  + {reason}
                </Badge>
              ))}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRejectModal(false)}
              disabled={processing}
            >
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectListing}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
