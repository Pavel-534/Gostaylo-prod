'use client'

import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { AlertTriangle, Check, CheckCheck, Paperclip, Shield } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function MessageReadTicks({ isOwn, isRead, className }) {
  if (!isOwn) return null
  return isRead ? (
    <CheckCheck className={cn('h-3.5 w-3.5 shrink-0 text-sky-200', className)} aria-label="Прочитано" />
  ) : (
    <Check className={cn('h-3.5 w-3.5 shrink-0 text-slate-300', className)} aria-label="Доставлено" />
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
}) {
  const created = msg.created_at || msg.createdAt
  const meta = msg.metadata || {}
  const rawType = String(msg.type || '').toLowerCase()
  const text = msg.message ?? msg.content ?? ''

  const imgUrl = meta.image_url || meta.url
  const fileUrl = meta.file_url || (rawType === 'file' ? meta.url : null)
  const fileName = meta.file_name || meta.name || 'Файл'

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
    body = <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
  }

  return (
    <div className={cn('flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {showAvatar ? (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback
            className={cn(
              isOwn ? 'bg-teal-100 text-teal-700' : isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200'
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
          {created && (
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(created), { addSuffix: true, locale: ru })}
            </span>
          )}
          <MessageReadTicks isOwn={isOwn} isRead={msg.is_read ?? msg.isRead} className={ticksClassName} />
        </div>
      </div>
    </div>
  )
}
