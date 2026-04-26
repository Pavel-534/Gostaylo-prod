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
  X, Sparkles, ExternalLink, Phone, Mail, Pencil
} from 'lucide-react'

export default function ModerationPage() {
  const [pendingListings, setPendingListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedListing, setSelectedListing] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingListing, setRejectingListing] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [editTextMode, setEditTextMode] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedListing) return
    setEditTextMode(false)
    setDraftTitle(selectedListing.title ?? '')
    setDraftDescription(selectedListing.description ?? '')
  }, [selectedListing?.id])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/moderation')
      const data = await res.json()
      
      if (data.success) {
        setPendingListings(data.listings || [])
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

  async function handleApproveListing(listingId) {
    const titleTrim = (draftTitle || '').trim()
    if (!titleTrim) {
      toast.error('Укажите заголовок объявления')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          action: 'approve',
          title: titleTrim,
          description: draftDescription ?? '',
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(data.notificationSent 
          ? 'Объявление одобрено! Партнёр уведомлён в Telegram'
          : 'Объявление одобрено!'
        )
        setSelectedListing(null)
        loadData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Не удалось одобрить объявление')
    } finally {
      setProcessing(false)
    }
  }

  async function openRejectModal(listing) {
    setRejectingListing(listing)
    setRejectReason('')
    setShowRejectModal(true)
  }

  async function handleRejectListing() {
    if (!rejectingListing || !rejectReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }

    setProcessing(true)
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
      setProcessing(false)
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
              <p className="text-sm text-slate-600">Ожидают проверки</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingListings.map((listing) => (
            <Card 
              key={listing.id} 
              className="bg-white overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setSelectedListing(listing)}
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                {listing.images?.[0] ? (
                  <ProxiedImage
                    src={listing.images[0]}
                    alt={listing.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-2">
                  <Badge className="bg-orange-500">На проверке</Badge>
                </div>
                
                {/* Photo count */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {listing.images?.length || 0} фото
                </div>
              </div>
              
              {/* Content */}
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 line-clamp-1 mb-1">
                  {listing.title || 'Без названия'}
                </h3>
                <p className="text-sm text-slate-600 flex items-center gap-1 mb-2">
                  <MapPin className="h-3 w-3" />
                  {listing.district || 'Район не указан'}
                </p>
                
                {/* Owner info */}
                <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                  <User className="h-3 w-3" />
                  <span>{listing.owner?.first_name || listing.owner?.email || 'Партнёр'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="font-bold text-indigo-600">
                    ฿{listing.base_price_thb?.toLocaleString() || 0}/день
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {listing.effectiveCommission}% комиссия
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed View Modal */}
      <Dialog
        open={!!selectedListing}
        onOpenChange={(open) => {
          if (!open) setSelectedListing(null)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
          {selectedListing && (
            <>
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
                  className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full z-20 shadow-lg"
                  onClick={() => setSelectedListing(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 md:p-6 space-y-4">
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
                    <p className="text-slate-600 flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {selectedListing.district || 'Район не указан'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!editTextMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-slate-700"
                          onClick={() => setEditTextMode(true)}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          Править текст
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDraftTitle(selectedListing.title ?? '')
                            setDraftDescription(selectedListing.description ?? '')
                            setEditTextMode(false)
                          }}
                        >
                          Сбросить правки
                        </Button>
                      )}
                    </div>
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
                      ฿{selectedListing.base_price_thb?.toLocaleString() || 0}
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

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button
                    onClick={() => handleApproveListing(selectedListing.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base"
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-5 w-5 mr-2" />
                    )}
                    Одобрить
                  </Button>
                  
                  <Button
                    onClick={() => openRejectModal(selectedListing)}
                    variant="destructive"
                    className="flex-1 h-12 text-base"
                    disabled={processing}
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Отклонить
                  </Button>
                </div>
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
