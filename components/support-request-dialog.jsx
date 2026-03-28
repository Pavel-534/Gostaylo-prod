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
import { Loader2, LifeBuoy } from 'lucide-react'
import { toast } from 'sonner'
import { SUPPORT_REASONS, SUPPORT_DISPUTE_KINDS } from '@/lib/support-request-options'

/**
 * Форма обращения в поддержку (не мгновенная «тревога»): тема + суть + текст.
 */
export function SupportRequestDialog({
  open,
  onOpenChange,
  conversationId,
  language = 'ru',
  onSubmitted,
}) {
  const [category, setCategory] = useState('')
  const [disputeType, setDisputeType] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRu = language !== 'en'

  function reset() {
    setCategory('')
    setDisputeType('')
    setDetails('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!conversationId) {
      toast.error(isRu ? 'Чат не выбран' : 'No conversation')
      return
    }
    if (!category || !disputeType) {
      toast.error(isRu ? 'Выберите причину и суть обращения' : 'Choose topic and dispute type')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v2/chat/escalate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          category,
          disputeType,
          details: details.trim().slice(0, 2000),
          lang: isRu ? 'ru' : 'en',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || (isRu ? 'Не удалось отправить' : 'Failed to send'))
        return
      }
      toast.success(
        isRu
          ? 'Обращение отправлено. Поддержка увидит детали в чате.'
          : 'Request sent. Support will see the details in chat.'
      )
      onOpenChange(false)
      reset()
      onSubmitted?.(json.data)
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-amber-600" />
            {isRu ? 'Помощь поддержки' : 'Contact support'}
          </DialogTitle>
          <DialogDescription>
            {isRu
              ? 'Кратко опишите ситуацию — это не экстренный вызов: сообщение появится в чате, модераторы увидят тему и контекст.'
              : 'Briefly describe the situation. This is not an emergency ping — a structured message will appear in the chat for staff.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{isRu ? 'Почему обращаетесь' : 'Why are you contacting us'}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={isRu ? 'Выберите…' : 'Choose…'} />
              </SelectTrigger>
              <SelectContent className="z-[130]">
                {SUPPORT_REASONS.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {isRu ? r.labelRu : r.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRu ? 'В чём спор / что нужно' : 'What is the issue'}</Label>
            <Select value={disputeType} onValueChange={setDisputeType}>
              <SelectTrigger>
                <SelectValue placeholder={isRu ? 'Выберите…' : 'Choose…'} />
              </SelectTrigger>
              <SelectContent className="z-[130]">
                {SUPPORT_DISPUTE_KINDS.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {isRu ? r.labelRu : r.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRu ? 'Комментарий (по желанию)' : 'Details (optional)'}</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isRu
                  ? 'Кратко: что произошло, номер брони, даты…'
                  : 'What happened, booking ID, dates…'
              }
              rows={4}
              maxLength={2000}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRu ? (
                'Отправить в поддержку'
              ) : (
                'Send to support'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
