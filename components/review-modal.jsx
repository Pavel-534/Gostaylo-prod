/**
 * GoStayLo - Review Submission Modal (Phase 4)
 * 
 * Premium 5-star category rating system:
 * - Cleanliness, Accuracy, Communication, Location, Value
 * - Teal-600 aesthetic
 * - Optimistic UI updates
 * 
 * @version 1.0
 */

'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, X, Loader2, CheckCircle, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { processAndUploadReviewPhotos } from '@/lib/services/image-upload.service'

const RATING_CATEGORIES = [
  { key: 'cleanliness', label: 'Cleanliness', icon: '🧹' },
  { key: 'accuracy', label: 'Accuracy', icon: '📸' },
  { key: 'communication', label: 'Communication', icon: '💬' },
  { key: 'location', label: 'Location', icon: '📍' },
  { key: 'value', label: 'Value', icon: '💰' }
]

// Star rating component
function StarRating({ value, onChange, label }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">{value || 0}/5</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (value || 0)
                  ? 'fill-teal-600 text-teal-600'
                  : 'text-slate-300 hover:text-slate-400'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

const MAX_REVIEW_PHOTOS = 5

export function ReviewModal({ isOpen, onClose, booking, userId, onSubmit, isSubmitting }) {
  const [ratings, setRatings] = useState({
    cleanliness: 0,
    accuracy: 0,
    communication: 0,
    location: 0,
    value: 0
  })
  const [comment, setComment] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const photoInputRef = useRef(null)
  
  if (!isOpen) return null
  
  const handleRatingChange = (category, value) => {
    setRatings(prev => ({ ...prev, [category]: value }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all ratings
    const allRated = Object.values(ratings).every(r => r > 0)
    if (!allRated) {
      toast.error('Please rate all categories')
      return
    }
    
    try {
      let photos = []
      if (photoFiles.length > 0 && userId && booking?.id) {
        photos = await processAndUploadReviewPhotos(photoFiles, userId, booking.id)
        if (photos.length !== photoFiles.length) {
          toast.error('Some photos failed to upload. Try again or remove them.')
          return
        }
      }
      await onSubmit({ ratings, comment, photos })
      setSubmitSuccess(true)
      setTimeout(() => {
        onClose()
        setSubmitSuccess(false)
        setRatings({ cleanliness: 0, accuracy: 0, communication: 0, location: 0, value: 0 })
        setComment('')
        setPhotoFiles([])
      }, 2000)
    } catch (error) {
      toast.error('Failed to submit review')
    }
  }

  function onPickPhotos(e) {
    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
    if (!picked.length) return
    setPhotoFiles((prev) => {
      const next = [...prev, ...picked].slice(0, MAX_REVIEW_PHOTOS)
      if (prev.length + picked.length > MAX_REVIEW_PHOTOS) {
        toast.error(`At most ${MAX_REVIEW_PHOTOS} photos`)
      }
      return next
    })
    e.target.value = ''
  }
  
  const averageRating = Object.values(ratings).reduce((sum, r) => sum + r, 0) / 5
  const listing = booking?.listing || {}
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {submitSuccess ? (
          // Success state
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Review Submitted!
            </h2>
            <p className="text-slate-600">
              Thank you for sharing your experience
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Leave a Review</h2>
                  <p className="text-slate-600 mt-1">{listing.title}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Average Rating Display */}
              {averageRating > 0 && (
                <div className="mt-4 p-4 bg-teal-50 rounded-lg flex items-center gap-3">
                  <div className="text-3xl font-bold text-teal-600">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= Math.round(averageRating)
                              ? 'fill-teal-600 text-teal-600'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">Overall Rating</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Rating Categories */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-3">Rate Your Experience</h3>
                
                {RATING_CATEGORIES.map(({ key, label, icon }) => (
                  <div key={key} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{icon}</span>
                      <span className="font-medium text-slate-900">{label}</span>
                    </div>
                    <StarRating
                      value={ratings[key]}
                      onChange={(value) => handleRatingChange(key, value)}
                      label=""
                    />
                  </div>
                ))}
              </div>
              
              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Share your experience (optional)
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you like? What could be improved?"
                  rows={4}
                  className="resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {comment.length}/1000 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Photos (optional, max {MAX_REVIEW_PHOTOS})</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={onPickPhotos}
                    disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-1 h-4 w-4 inline" />
                    Add photos
                  </Button>
                  {photoFiles.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoFiles([])}>
                      Clear
                    </Button>
                  )}
                </div>
                {photoFiles.length > 0 && (
                  <p className="text-xs text-slate-500">{photoFiles.length} image(s) selected (WebP compression on upload)</p>
                )}
              </div>
              
              {/* Privacy Notice */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Your privacy matters:</span> Your review will be published with your first name and last initial (e.g., "Pavel S.").
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
