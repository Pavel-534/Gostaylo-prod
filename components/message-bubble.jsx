'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { AlertTriangle, Check, CheckCheck, Languages, Loader2, Paperclip, Shield } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * @param {'light' | 'dark'} bubbleTone — dark: «свои» пузыри (teal/indigo фон); light: светлый фон
 */
export function MessageReadTicks({ isOwn, isRead, className, bubbleTone = 'light' }) {
  if (!isOwn) return null
  if (bubbleTone === 'dark') {
    return isRead ? (
      <CheckCheck className={cn('h-3.5 w-3.5 shrink-0 text-sky-300', className)} aria-label="Прочитано" />
    ) : (
      <Check className={cn('h-3.5 w-3.5 shrink-0 text-slate-300', className)} aria-label="Отправлено" />
    )
  }
  return isRead ? (
    <CheckCheck className={cn('h-3.5 w-3.5 shrink-0 text-blue-600', className)} aria-label="Прочитано" />
  ) : (
    <Check className={cn('h-3.5 w-3.5 shrink-0 text-slate-400', className)} aria-label="Отправлено" />
  )
}

/**
 * Чат-пузырь с текстом / изображением / файлом и галочками WhatsApp-style.
 */
export function MessageBubble({
  msg,
  isOwn,
  showAvatar = true,
  avatarFallback,
  showSenderName = false,
  senderName,
  isAdmin = false,
  isRejection = false,
  ticksClassName,
  /** «Свои» сообщения: teal (арендатор/партнёр) или indigo (админ-панель) */
  ownVariant = 'teal',
  /** Код языка UI (ru, en) — если задан, показываем кнопку перевода для текстовых сообщений */
  translateTargetLang = null,
  translateButtonLabels = { translate: 'Translate', original: 'Original', translating: '…' },
}) {
  const [translated, setTranslated] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)
  const [translating, setTranslating] = useState(false)

  const created = msg.created_at || msg.createdAt
  let createdRelative = null
  if (created) {
    const d = new Date(created)
    if (!Number.isNaN(d.getTime())) {
      try {
        createdRelative = formatDistanceToNow(d, { addSuffix: true, locale: ru })
      } catch {
        createdRelative = null
      }
    }
  }
  const meta = msg.metadata || {}
  const rawType = String(msg.type || '').toLowerCase()
  const text = msg.message ?? msg.content ?? ''

  const imgUrl = meta.image_url || meta.url
  const fileUrl = meta.file_url || (rawType === 'file' ? meta.url : null)
  const fileName = meta.file_name || meta.name || 'Файл'

  const canTranslate =
    translateTargetLang &&
    !isRejection &&
    (rawType === 'text' || rawType === '') &&
    text.trim().length > 0 &&
    !imgUrl &&
    !fileUrl

  async function runTranslate() {
    if (!translateTargetLang || !text.trim()) return
    setTranslating(true)
    try {
      const res = await fetch('/api/v2/translate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target: translateTargetLang }),
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.translatedText) {
        toast.error(json.error || 'Перевод недоступен')
        return
      }
      setTranslated(json.data.translatedText)
      setShowTranslated(true)
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setTranslating(false)
    }
  }

  const displayText = showTranslated && translated ? translated : text

  /** Галочки: на тёмном пузыре (свои) — светлые иконки */
  const tickTone = isOwn ? 'dark' : 'light'

  let body = null
  if (rawType === 'image' && imgUrl && typeof imgUrl === 'string') {
    body = (
      <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[min(100%,280px)]">
        <img src={imgUrl} alt="" className="rounded-lg max-h-64 w-full object-cover" />
      </a>
    )
  } else if (rawType === 'file' && fileUrl) {
    body = (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm underline break-all"
      >
        <Paperclip className="h-4 w-4 shrink-0" />
        {fileName}
      </a>
    )
  } else {
    body = <p className="text-sm whitespace-pre-wrap break-words">{displayText}</p>
  }

  return (
    <div className={cn('flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {showAvatar ? (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback
            className={cn(
              isOwn
                ? ownVariant === 'indigo'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-teal-100 text-teal-700'
                : isAdmin
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200'
            )}
          >
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}
      <div className={cn('flex flex-col min-w-0 max-w-[min(100%,20rem)]', isOwn ? 'items-end' : 'items-start')}>
        {showSenderName && senderName ? (
          <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            {isAdmin && <Shield className="h-3 w-3 text-indigo-500" />}
            {senderName}
          </span>
        ) : null}
        <div
          className={cn(
            'px-4 py-2 rounded-2xl',
            isRejection
              ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none'
              : isOwn
                ? ownVariant === 'indigo'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-teal-600 text-white rounded-tr-none'
                : isAdmin
                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-tl-none'
                  : 'bg-white text-slate-900 rounded-tl-none shadow-sm border'
          )}
        >
          {isRejection && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm">Listing Rejected</span>
            </div>
          )}
          {body}
        </div>
        <div className="flex items-center gap-1 mt-1 justify-end">
          {createdRelative ? <span className="text-xs text-slate-500">{createdRelative}</span> : null}
          <MessageReadTicks
            isOwn={isOwn}
            isRead={msg.is_read ?? msg.isRead}
            bubbleTone={tickTone}
            className={ticksClassName}
          />
        </div>
        {canTranslate ? (
          <div className={cn('mt-1 w-full', isOwn ? 'flex justify-end' : 'flex justify-start')}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800"
              disabled={translating}
              onClick={() => {
                if (showTranslated) {
                  setShowTranslated(false)
                  return
                }
                if (translated) {
                  setShowTranslated(true)
                  return
                }
                runTranslate()
              }}
            >
              {translating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  {translateButtonLabels.translating}
                </>
              ) : showTranslated ? (
                translateButtonLabels.original
              ) : (
                <>
                  <Languages className="h-3 w-3 mr-1" />
                  {translateButtonLabels.translate}
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
