'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, Calendar, MapPin, Loader2, Upload, X, MessageSquare, ArrowLeft } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import { ProxiedImage } from '@/components/proxied-image'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [mockPhotos, setMockPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Mock photos for testing
  const MOCK_PHOTO_URLS = [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=800&q=80',
  ]

  useEffect(() => {
    loadBookings()
  }, [])

  async function loadBookings() {
    try {
      // For now, load all bookings from partner API and filter for renter-3
      // In real app, we'd have a renter-specific endpoint
      const res = await fetch('/api/partner/bookings?partnerId=partner-1')
      const data = await res.json()
      
      if (data.success) {
        // Filter only completed bookings for this demo
        const completedBookings = data.data.filter(b => b.status === 'COMPLETED')
        setBookings(completedBookings)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load bookings:', error)
      setLoading(false)
    }
  }

  function openReviewModal(booking) {
    setSelectedBooking(booking)
    setRating(0)
    setComment('')
    setMockPhotos([])
    setReviewModalOpen(true)
  }

  function handleAddMockPhoto() {
    if (mockPhotos.length >= 3) {
      toast.error('Максимум 3 фото')
      return
    }
    // Add a random mock photo
    const randomPhoto = MOCK_PHOTO_URLS[Math.floor(Math.random() * MOCK_PHOTO_URLS.length)]
    setMockPhotos([...mockPhotos, randomPhoto])
  }

  function handleRemovePhoto(index) {
    setMockPhotos(mockPhotos.filter((_, i) => i !== index))
  }

  async function handleReviewSubmit(e) {
    e.preventDefault()

    if (!rating) {
      toast.error('Поставьте оценку')
      return
    }

    if (!comment.trim()) {
      toast.error('Напишите комментарий')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          renterId: selectedBooking.renterId,
          renterName: selectedBooking.guestName,
          listingId: selectedBooking.listingId,
          rating,
          comment: comment.trim(),
          photos: mockPhotos,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Отзыв опубликован! Спасибо за ваше мнение.')
        setReviewModalOpen(false)
        loadBookings() // Reload to update state
      } else {
        toast.error(data.error || 'Ошибка при публикации отзыва')
      }
    } catch (error) {
      console.error('Failed to submit review:', error)
      toast.error('Ошибка при публикации отзыва')
    } finally {
      setSubmitting(false)
    }
  }

  async function checkIfCanReview(bookingId) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/can-review`)
      const data = await res.json()
      return data.data?.canReview || false
    } catch (error) {
      return false
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            На главную
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Мои завершённые бронирования</h1>
          <p className="text-slate-600">Оставьте отзывы о вашем опыте</p>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет завершённых бронирований</h3>
              <p className="text-slate-600 mb-4">После завершения аренды вы сможете оставить отзыв</p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Перейти к поиску</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl mb-2">{booking.listingTitle}</CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(booking.checkIn).toLocaleDateString('ru-RU')} -{' '}
                            {new Date(booking.checkOut).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>Phuket, Thailand</span>
                        </div>
                      </CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      Завершено
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Стоимость</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatPrice(booking.priceThb, 'THB')}
                      </p>
                    </div>
                    <Button
                      onClick={() => openReviewModal(booking)}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Оставить отзыв
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Review Modal */}
        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Оставьте отзыв</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleReviewSubmit} className="space-y-6">
              {/* Rating Stars */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Ваша оценка</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= (hoverRating || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-sm text-slate-600 mt-2">
                    {rating === 5 && '⭐ Отлично!'}
                    {rating === 4 && '😊 Хорошо'}
                    {rating === 3 && '🙂 Нормально'}
                    {rating === 2 && '😐 Так себе'}
                    {rating === 1 && '😞 Плохо'}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <Label htmlFor="comment" className="text-base font-semibold mb-3 block">
                  Ваш отзыв
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Поделитесь впечатлениями о вашей аренде..."
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Ваш отзыв поможет другим пользователям принять решение
                </p>
              </div>

              {/* Photo Upload (Mock) */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Добавьте фото (необязательно)
                </Label>
                <div className="flex flex-wrap gap-3">
                  {mockPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden">
                      <ProxiedImage
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        width={96}
                        height={96}
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {mockPhotos.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddMockPhoto}
                      className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-teal-500 hover:text-teal-600 transition"
                    >
                      <Upload className="h-6 w-6 mb-1" />
                      <span className="text-xs">Добавить</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  🎭 Mock: Нажмите "Добавить" для случайного фото (макс. 3)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!rating || !comment.trim() || submitting}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Публикация...
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Опубликовать отзыв
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewModalOpen(false)}
                  disabled={submitting}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
