'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Star, MessageSquare, CheckCircle2, Loader2, Reply } from 'lucide-react'
import { toast } from 'sonner'

// Star rating display
function StarRating({ rating }) {
  return (
    <div className='flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-200 text-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

export default function PartnerReviewsPage() {
  const router = useRouter()
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({ total: 0, averageRating: 0 })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('funnyrent_user')
    if (stored) {
      const parsed = JSON.parse(stored)
      setUser(parsed)
      loadReviews(parsed.id)
    }
  }, [])

  async function loadReviews(partnerId) {
    try {
      const res = await fetch(`/api/v2/reviews?partner_id=${partnerId}`)
      const data = await res.json()
      
      if (data.success) {
        setReviews(data.data.reviews)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitReply() {
    if (!replyText.trim()) {
      toast.error('Введите текст ответа')
      return
    }

    setSubmittingReply(true)
    try {
      const res = await fetch(`/api/v2/reviews/${replyingTo}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: user.id,
          reply: replyText.trim()
        })
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success('Ответ отправлен!')
        setReplyingTo(null)
        setReplyText('')
        loadReviews(user.id) // Reload reviews
      } else {
        toast.error(data.error || 'Не удалось отправить ответ')
      }
    } catch (error) {
      toast.error('Ошибка при отправке ответа')
    } finally {
      setSubmittingReply(false)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-slate-900'>Отзывы</h1>
        <p className='text-slate-600 mt-1'>Управление отзывами гостей о ваших объектах</p>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <p className='text-3xl font-bold text-slate-900'>{stats.total}</p>
              <p className='text-sm text-slate-600'>Всего отзывов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <div className='flex items-center justify-center gap-2'>
                <p className='text-3xl font-bold text-amber-500'>{stats.averageRating.toFixed(1)}</p>
                <Star className='h-6 w-6 fill-amber-400 text-amber-400' />
              </div>
              <p className='text-sm text-slate-600'>Средняя оценка</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <p className='text-3xl font-bold text-teal-600'>
                {reviews.filter(r => !r.partnerReply).length}
              </p>
              <p className='text-sm text-slate-600'>Без ответа</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className='py-12 text-center text-slate-500'>
          <Loader2 className='h-8 w-8 animate-spin mx-auto mb-2' />
          Загрузка отзывов...
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className='py-12 text-center'>
            <Star className='h-12 w-12 text-slate-300 mx-auto mb-4' />
            <p className='text-slate-500'>Пока нет отзывов</p>
            <p className='text-sm text-slate-400 mt-1'>Отзывы появятся после первых бронирований</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className='pt-6'>
                <div className='flex items-start gap-4'>
                  {/* Avatar */}
                  <div className='w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0'>
                    <span className='text-teal-700 font-semibold text-lg'>
                      {review.reviewerInitial}
                    </span>
                  </div>
                  
                  <div className='flex-1 min-w-0'>
                    {/* Header */}
                    <div className='flex items-start justify-between gap-2 flex-wrap'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium text-slate-900'>
                            {review.reviewerName}
                          </span>
                          {review.isVerifiedBooking && (
                            <Badge variant='outline' className='text-xs text-green-700 border-green-300 bg-green-50'>
                              <CheckCircle2 className='h-3 w-3 mr-1' />
                              Подтверждено
                            </Badge>
                          )}
                        </div>
                        <div className='flex items-center gap-2 mt-1'>
                          <StarRating rating={review.rating} />
                          <span className='text-sm text-slate-500'>
                            {formatDate(review.createdAt)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Reply Button */}
                      {!review.partnerReply && (
                        <Dialog open={replyingTo === review.id} onOpenChange={(open) => {
                          if (open) {
                            setReplyingTo(review.id)
                            setReplyText('')
                          } else {
                            setReplyingTo(null)
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant='outline' size='sm'>
                              <Reply className='h-4 w-4 mr-1' />
                              Ответить
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ответ на отзыв</DialogTitle>
                            </DialogHeader>
                            <div className='py-4'>
                              <div className='bg-slate-50 rounded-lg p-3 mb-4'>
                                <div className='flex items-center gap-2 mb-1'>
                                  <span className='font-medium text-sm'>{review.reviewerName}</span>
                                  <StarRating rating={review.rating} />
                                </div>
                                <p className='text-sm text-slate-600'>{review.comment}</p>
                              </div>
                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder='Напишите ваш ответ...'
                                rows={4}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                variant='outline'
                                onClick={() => setReplyingTo(null)}
                              >
                                Отмена
                              </Button>
                              <Button
                                onClick={handleSubmitReply}
                                disabled={submittingReply || !replyText.trim()}
                                className='bg-teal-600 hover:bg-teal-700'
                              >
                                {submittingReply ? (
                                  <><Loader2 className='h-4 w-4 mr-2 animate-spin' /> Отправка...</>
                                ) : (
                                  'Отправить ответ'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    
                    {/* Comment */}
                    {review.comment && (
                      <p className='mt-3 text-slate-700'>{review.comment}</p>
                    )}
                    
                    {/* Partner Reply */}
                    {review.partnerReply && (
                      <div className='mt-4 pl-4 border-l-2 border-teal-200 bg-teal-50/50 rounded-r-lg py-3 pr-3'>
                        <div className='flex items-center gap-2 mb-1'>
                          <MessageSquare className='h-4 w-4 text-teal-600' />
                          <span className='text-sm font-medium text-teal-700'>Ваш ответ</span>
                          <span className='text-xs text-slate-500'>
                            {review.partnerReplyAt && formatDate(review.partnerReplyAt)}
                          </span>
                        </div>
                        <p className='text-sm text-slate-700'>{review.partnerReply}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
