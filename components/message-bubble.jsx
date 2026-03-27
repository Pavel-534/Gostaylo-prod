'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { AlertTriangle, Check, CheckCheck, Clock, Languages, Loader2, Paperclip, Shield } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { toRelativeSiteUrl } from '@/lib/chat-same-origin-url'
import { maskContactInfo } from '@/lib/mask-contacts'
import { highlightText } from '@/lib/chat-highlight-text'

/**
 * @param {'light' | 'dark'} bubbleTone — dark: «свои» пузыри (teal/indigo фон); light: светлый фон
 */
/**
 * status: 'sending' | 'sent' | undefined
 * Если status='sending' → часики (отправляется).
 * Если isRead=true → двойная синяя/голубая галочка (прочитано).
 * Иначе → одна серая (отправлено на сервер).
 */
export function MessageReadTicks({ isOwn, isRead, status, className, bubbleTone = 'light' }) {
  if (!isOwn) return null

  if (status === 'sending') {
    return (
      <Clock
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-colors duration-150',
          bubbleTone === 'dark' ? 'text-slate-300/70' : 'text-slate-400/70',
          className,
        )}
        aria-label="Отправляется"
      />
    )
  }

  const read = Boolean(isRead)
  if (bubbleTone === 'dark') {
    return read ? (
      <CheckCheck
        className={cn('h-3.5 w-3.5 shrink-0 text-sky-300 transition-colors duration-300', className)}
        aria-label="Прочитано"
      />
    ) : (
      <Check
        className={cn('h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors duration-300', className)}
        aria-label="Отправлено"
      />
    )
  }
  return read ? (
    <CheckCheck
      className={cn('h-3.5 w-3.5 shrink-0 text-blue-600 transition-colors duration-300', className)}
      aria-label="Прочитано"
    />
  ) : (
    <Check
      className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors duration-300', className)}
      aria-label="Отправлено"
    />
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
  /**
   * Маскировать контакты (телефоны, e-mail, Telegram) в тексте?
   * true — если бронирование НЕ оплачено/подтверждено (защита от обхода комиссии).
   */
  maskContacts = false,
  /** Строка поиска для подсветки вхождений */
  searchHighlight = null,
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

  const rawDisplayText = showTranslated && translated ? translated : text
  // Маскируем контакты, если бронирование ещё не оплачено/подтверждено
  const displayText = maskContacts && !isOwn ? maskContactInfo(rawDisplayText) : rawDisplayText
  // Подсветка поиска: если задана строка поиска — рендерим с <mark>
  const renderedText = searchHighlight ? highlightText(displayText, searchHighlight) : displayText

  function renderTextWithLocalLinks(str) {
    if (!str) return null
    const s = String(str)
    const re = /https?:\/\/[^\s]+/gi
    const nodes = []
    let last = 0
    let m
    let k = 0
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) {
        nodes.push(<span key={`t-${k++}`}>{s.slice(last, m.index)}</span>)
      }
      const raw = m[0]
      const href = toRelativeSiteUrl(raw)
      if (href.startsWith('/')) {
        nodes.push(
          <Link key={`l-${k++}`} href={href} className="underline break-all font-medium" prefetch={false}>
            {raw}
          </Link>
        )
      } else {
        nodes.push(
          <a key={`a-${k++}`} href={raw} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {raw}
          </a>
        )
      }
      last = m.index + raw.length
    }
    if (last < s.length) {
      nodes.push(<span key={`t-${k++}`}>{s.slice(last)}</span>)
    }
    return nodes.length ? nodes : s
  }

  /** Галочки: на тёмном пузыре (свои) — светлые иконки */
  const tickTone = isOwn ? 'dark' : 'light'
  const isSending = msg._status === 'sending'

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
    // Если есть поиск — renderTextWithLocalLinks не применяем (там string-only логика),
    // вместо этого используем renderedText с подсветкой
    body = (
      <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {searchHighlight ? renderedText : renderTextWithLocalLinks(displayText)}
      </p>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full gap-3',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isSending && 'opacity-60',
      )}
    >
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
      <div
        className={cn(
          'flex min-w-0 max-w-[min(100%,20rem)] flex-col overflow-hidden',
          isOwn ? 'items-end' : 'items-start',
        )}
      >
        {showSenderName && senderName ? (
          <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            {isAdmin && <Shield className="h-3 w-3 text-indigo-500" />}
            {senderName}
          </span>
        ) : null}
        <div
          className={cn(
            'px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl',
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
        <div
          className={cn(
            'flex items-center gap-1 mt-0.5 flex-wrap min-h-[1rem]',
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          {canTranslate ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700 -ml-0.5"
              disabled={translating}
              title={showTranslated ? translateButtonLabels.original : translateButtonLabels.translate}
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
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : showTranslated ? (
                <span className="text-[9px] font-medium text-slate-500">A↔Я</span>
              ) : (
                <Languages className="h-3 w-3" />
              )}
            </Button>
          ) : null}
          {createdRelative ? (
            <span className="text-[10px] sm:text-xs text-slate-500">{createdRelative}</span>
          ) : null}
          <MessageReadTicks
            isOwn={isOwn}
            isRead={Boolean(msg.is_read ?? msg.isRead)}
            status={msg._status}
            bubbleTone={tickTone}
            className={ticksClassName}
          />
        </div>
      </div>
    </div>
  )
}
