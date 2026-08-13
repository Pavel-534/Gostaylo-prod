'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, MessageSquareWarning } from 'lucide-react'
import { toast } from 'sonner'
import {
  PRODUCT_FEEDBACK_CATEGORIES,
  PRODUCT_FEEDBACK_DETAILS_MAX,
} from '@/lib/feedback/product-feedback-options'
import { postProductFeedback } from '@/lib/api/product-feedback-client'

/**
 * Site / UX product feedback (not booking chat escalate).
 */
export function ProductFeedbackDialog({ open, onOpenChange, language = 'ru' }) {
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRu = language !== 'en'

  function reset() {
    setCategory('')
    setDetails('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!category) {
      toast.error(isRu ? 'Выберите категорию' : 'Choose a category')
      return
    }
    const text = details.trim()
    if (text.length < 10) {
      toast.error(
        isRu ? 'Опишите проблему чуть подробнее (от 10 символов)' : 'Please add a bit more detail (10+ characters)',
      )
      return
    }
    setSubmitting(true)
    try {
      const pathname =
        typeof window !== 'undefined' ? String(window.location?.pathname || '/') : '/'
      const pageUrl =
        typeof window !== 'undefined'
          ? String(window.location?.href || pathname).slice(0, 800)
          : pathname
      const userAgent = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
      const { ok, error, status } = await postProductFeedback({
        category,
        details: text.slice(0, PRODUCT_FEEDBACK_DETAILS_MAX),
        pathname,
        pageUrl,
        userAgent,
        language: isRu ? 'ru' : 'en',
      })
      if (!ok) {
        if (status === 401) {
          toast.error(isRu ? 'Войдите, чтобы отправить сообщение' : 'Sign in to send feedback')
        } else if (status === 429) {
          toast.error(
            isRu ? 'Слишком много сообщений — попробуйте позже' : 'Too many reports — try again later',
          )
        } else {
          toast.error(
            error === 'DETAILS_TOO_SHORT'
              ? isRu
                ? 'Слишком короткий текст'
                : 'Message too short'
              : isRu
                ? 'Не удалось отправить'
                : 'Failed to send',
          )
        }
        return
      }
      toast.success(
        isRu
          ? 'Спасибо! Мы получили сообщение и разберёмся.'
          : 'Thanks! We got your message and will look into it.',
      )
      onOpenChange(false)
      reset()
    } catch {
      toast.error(isRu ? 'Ошибка сети' : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v)
      }}
    >
      <DialogContent mobileAnchor="bottom" className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-brand" />
            {isRu ? 'Сообщить о проблеме' : 'Report a problem'}
          </DialogTitle>
          <DialogDescription>
            {isRu
              ? 'Сбой сайта, непонятный экран или идея — без привязки к брони. Споры по заказу лучше решать в чате бронирования.'
              : 'Site bugs, confusing screens, or ideas — not tied to a booking. For order disputes, use the booking chat.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{isRu ? 'Категория' : 'Category'}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={isRu ? 'Выберите…' : 'Choose…'} />
              </SelectTrigger>
              <SelectContent className="z-[230]" position="popper">
                {PRODUCT_FEEDBACK_CATEGORIES.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {isRu ? r.labelRu : r.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-feedback-details">{isRu ? 'Что произошло' : 'What happened'}</Label>
            <Textarea
              id="product-feedback-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={PRODUCT_FEEDBACK_DETAILS_MAX}
              rows={5}
              placeholder={
                isRu
                  ? 'Кратко опишите проблему или идею…'
                  : 'Briefly describe the issue or idea…'
              }
              className="min-h-[120px] resize-y"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="submit" variant="brand" className="min-h-[44px]" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isRu ? 'Отправка…' : 'Sending…'}
                </>
              ) : isRu ? (
                'Отправить'
              ) : (
                'Send'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
