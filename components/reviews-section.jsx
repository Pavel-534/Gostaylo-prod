/**
 * Gostaylo - Public Reviews Section
 * Displays reviews on listing detail page
 * - Star ratings
 * - Verified booking badge
 * - Partner replies
 */

'use client';

import { useState, useEffect } from 'react';
import { Star, CheckCircle2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Star rating display
function StarRating({ rating, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  
  return (
    <div className='flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-200 text-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// Interactive star rating for writing reviews
function StarRatingInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  
  return (
    <div className='flex items-center gap-1'>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type='button'
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className='p-0.5 transition-transform hover:scale-110'
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-200 text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Single review card
function ReviewCard({ review, language = 'ru' }) {
  const [showFullReply, setShowFullReply] = useState(false);
  
  const t = {
    ru: {
      verifiedBooking: 'Подтверждённое бронирование',
      partnerReply: 'Ответ владельца',
      showMore: 'Показать больше',
      showLess: 'Скрыть'
    },
    en: {
      verifiedBooking: 'Verified booking',
      partnerReply: 'Owner response',
      showMore: 'Show more',
      showLess: 'Show less'
    }
  }[language] || {
    verifiedBooking: 'Verified booking',
    partnerReply: 'Owner response',
    showMore: 'Show more',
    showLess: 'Show less'
  };

  const formattedDate = new Date(review.createdAt).toLocaleDateString(
    language === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  );

  return (
    <div className='py-4'>
      <div className='flex items-start gap-3'>
        {/* Avatar */}
        <div className='w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0'>
          <span className='text-teal-700 font-semibold'>{review.reviewerInitial}</span>
        </div>
        
        <div className='flex-1 min-w-0'>
          {/* Header */}
          <div className='flex items-center justify-between gap-2 flex-wrap'>
            <div className='flex items-center gap-2'>
              <span className='font-medium text-slate-900'>{review.reviewerName}</span>
              {review.isVerifiedBooking && (
                <Badge variant='outline' className='text-xs text-green-700 border-green-300 bg-green-50'>
                  <CheckCircle2 className='h-3 w-3 mr-1' />
                  {t.verifiedBooking}
                </Badge>
              )}
            </div>
            <span className='text-xs text-slate-500'>{formattedDate}</span>
          </div>
          
          {/* Rating */}
          <div className='mt-1'>
            <StarRating rating={review.rating} size='sm' />
          </div>
          
          {/* Comment */}
          {review.comment && (
            <p className='mt-2 text-slate-700 text-sm leading-relaxed'>
              {review.comment}
            </p>
          )}
          
          {/* Partner Reply */}
          {review.partnerReply && (
            <div className='mt-3 pl-3 border-l-2 border-teal-200 bg-teal-50/50 rounded-r-lg py-2 pr-3'>
              <div className='flex items-center gap-2 mb-1'>
                <MessageSquare className='h-3.5 w-3.5 text-teal-600' />
                <span className='text-xs font-medium text-teal-700'>{t.partnerReply}</span>
              </div>
              <p className={`text-sm text-slate-600 ${!showFullReply && review.partnerReply.length > 200 ? 'line-clamp-3' : ''}`}>
                {review.partnerReply}
              </p>
              {review.partnerReply.length > 200 && (
                <button
                  onClick={() => setShowFullReply(!showFullReply)}
                  className='text-xs text-teal-600 hover:text-teal-800 mt-1 flex items-center gap-1'
                >
                  {showFullReply ? (
                    <><ChevronUp className='h-3 w-3' /> {t.showLess}</>
                  ) : (
                    <><ChevronDown className='h-3 w-3' /> {t.showMore}</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Write review dialog
function WriteReviewDialog({ listingId, bookingId, onSuccess, language = 'ru' }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = {
    ru: {
      writeReview: 'Написать отзыв',
      yourRating: 'Ваша оценка',
      yourComment: 'Ваш комментарий (необязательно)',
      commentPlaceholder: 'Расскажите о вашем опыте...',
      submit: 'Отправить отзыв',
      selectRating: 'Выберите оценку'
    },
    en: {
      writeReview: 'Write a Review',
      yourRating: 'Your Rating',
      yourComment: 'Your Comment (optional)',
      commentPlaceholder: 'Share your experience...',
      submit: 'Submit Review',
      selectRating: 'Please select a rating'
    }
  }[language] || {
    writeReview: 'Write a Review',
    yourRating: 'Your Rating',
    yourComment: 'Your Comment (optional)',
    commentPlaceholder: 'Share your experience...',
    submit: 'Submit Review',
    selectRating: 'Please select a rating'
  };

  const handleSubmit = async () => {
    if (!rating) {
      toast.error(t.selectRating);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId,
          bookingId,
          rating,
          comment
        })
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(language === 'ru' ? 'Отзыв отправлен!' : 'Review submitted!');
        setOpen(false);
        setRating(0);
        setComment('');
        onSuccess?.();
      } else {
        toast.error(data.error || 'Failed to submit review');
      }
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className='bg-teal-600 hover:bg-teal-700'>
          <Star className='h-4 w-4 mr-2' />
          {t.writeReview}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.writeReview}</DialogTitle>
        </DialogHeader>
        
        <div className='space-y-4 pt-2'>
          <div>
            <label className='text-sm font-medium text-slate-700 mb-2 block'>
              {t.yourRating}
            </label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          
          <div>
            <label className='text-sm font-medium text-slate-700 mb-2 block'>
              {t.yourComment}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.commentPlaceholder}
              rows={4}
            />
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={submitting || !rating}
            className='w-full bg-teal-600 hover:bg-teal-700'
          >
            {submitting ? 'Submitting...' : t.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Reviews Section Component
export function ReviewsSection({ listingId, language = 'ru' }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const t = {
    ru: {
      reviews: 'Отзывы',
      noReviews: 'Пока нет отзывов',
      beFirst: 'Станьте первым, кто оставит отзыв!',
      showAll: 'Показать все отзывы',
      showLess: 'Скрыть',
      basedOn: 'на основе'
    },
    en: {
      reviews: 'Reviews',
      noReviews: 'No reviews yet',
      beFirst: 'Be the first to leave a review!',
      showAll: 'Show all reviews',
      showLess: 'Show less',
      basedOn: 'based on'
    }
  }[language] || {
    reviews: 'Reviews',
    noReviews: 'No reviews yet',
    beFirst: 'Be the first to leave a review!',
    showAll: 'Show all reviews',
    showLess: 'Show less',
    basedOn: 'based on'
  };

  useEffect(() => {
    loadReviews();
  }, [listingId]);

  async function loadReviews() {
    try {
      const res = await fetch(`/api/v2/reviews?listing_id=${listingId}`);
      const data = await res.json();
      
      if (data.success) {
        setReviews(data.data.reviews);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-3'>
            {t.reviews}
            {stats.total > 0 && (
              <div className='flex items-center gap-2'>
                <StarRating rating={Math.round(stats.averageRating)} size='sm' />
                <span className='text-lg font-bold text-slate-900'>
                  {stats.averageRating.toFixed(1)}
                </span>
                <span className='text-sm text-slate-500'>
                  ({stats.total} {t.basedOn})
                </span>
              </div>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className='py-8 text-center text-slate-500'>Loading...</div>
        ) : reviews.length === 0 ? (
          <div className='py-8 text-center'>
            <p className='text-slate-500 mb-2'>{t.noReviews}</p>
            <p className='text-sm text-slate-400'>{t.beFirst}</p>
          </div>
        ) : (
          <>
            <div className='divide-y divide-slate-100'>
              {displayedReviews.map((review) => (
                <ReviewCard key={review.id} review={review} language={language} />
              ))}
            </div>
            
            {reviews.length > 3 && (
              <div className='pt-4 text-center'>
                <Button
                  variant='outline'
                  onClick={() => setShowAll(!showAll)}
                  className='text-teal-600 border-teal-200 hover:bg-teal-50'
                >
                  {showAll ? t.showLess : `${t.showAll} (${reviews.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { StarRating, StarRatingInput, WriteReviewDialog, ReviewCard };
