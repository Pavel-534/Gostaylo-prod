'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Star, MessageSquare, Loader2, TrendingUp, Award, Clock } from 'lucide-react'
import { toast } from 'sonner'

export default function PartnerReviews() {
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReviews()
  }, [])

  async function loadReviews() {
    try {
      const res = await fetch('/api/partner/reviews?partnerId=partner-1')
      const data = await res.json()
      
      if (data.success) {
        setReviews(data.data.reviews)
        setStats(data.data.stats)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load reviews:', error)
      setLoading(false)
    }
  }

  async function handleReplySubmit(reviewId) {
    if (!replyText.trim()) {
      toast.error('Введите текст ответа')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyText: replyText.trim(),
          partnerId: 'partner-1',
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Ответ опубликован!')
        setReplyingTo(null)
        setReplyText('')
        loadReviews() // Reload to get updated data
      } else {
        toast.error(data.error || 'Ошибка при публикации ответа')
      }
    } catch (error) {
      console.error('Failed to reply:', error)
      toast.error('Ошибка при публикации ответа')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Отзывы</h1>
        <p className="text-slate-600">Управляйте репутацией ваших объявлений</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний рейтинг</CardTitle>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">
              {stats.averageRating || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">из 5 звёзд</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего отзывов</CardTitle>
            <Award className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalReviews || 0}</div>
            <p className="text-xs text-slate-500 mt-1">по всем объявлениям</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ожидают ответа</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.reviewsWithoutReply || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">требуют внимания</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Пока нет отзывов</h3>
            <p className="text-slate-600">Отзывы появятся после завершения бронирований</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className={!review.partnerReply ? 'border-orange-200 bg-orange-50/30' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 ${
                              i < review.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-200 text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-slate-900">{review.renterName}</span>
                      {!review.partnerReply && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                          Нужен ответ
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {review.listingTitle} • {new Date(review.createdAt).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Review Text */}
                <p className="text-slate-700 leading-relaxed">{review.comment}</p>

                {/* Review Photos */}
                {review.photos && review.photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {review.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Review photo ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}

                {/* Partner Reply Section */}
                {review.partnerReply ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-teal-600" />
                      <span className="font-semibold text-teal-900">Ваш ответ</span>
                      <span className="text-sm text-slate-500">
                        {new Date(review.partnerReply.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-slate-700">{review.partnerReply.text}</p>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    {replyingTo === review.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Напишите ответ на отзыв..."
                          rows={3}
                          className="resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleReplySubmit(review.id)}
                            disabled={submitting || !replyText.trim()}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Публикация...
                              </>
                            ) : (
                              'Опубликовать ответ'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReplyingTo(null)
                              setReplyText('')
                            }}
                            disabled={submitting}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setReplyingTo(review.id)}
                        className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ответить на отзыв
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
