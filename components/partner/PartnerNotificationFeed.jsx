'use client'

/**
 * Stage 140.3 — Partner notification bell + dropdown feed.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { usePartnerNotifications } from '@/contexts/partner-notification-context'

const DATE_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

function kindIconClass(kind) {
  if (kind === 'payment_received') return 'bg-emerald-100 text-emerald-700'
  if (kind === 'new_booking') return 'bg-brand/15 text-brand'
  if (kind === 'wallet_credit') return 'bg-violet-100 text-violet-700'
  return 'bg-slate-100 text-slate-600'
}

export function PartnerNotificationFeed({ language = 'ru', className }) {
  const router = useRouter()
  const { items, unreadCount, markRead, markAllRead } = usePartnerNotifications()
  const locale = DATE_LOCALE[language] || ru

  function handleOpenItem(item) {
    markRead(item.id)
    if (item.href) router.push(item.href)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className={cn('relative text-slate-500 hover:text-slate-700', className)}
          aria-label={getUIText('partnerNotif_bellAria', language)}
        >
          <Bell className='h-4 w-4' />
          {unreadCount > 0 ? (
            <span className='absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[min(100vw-2rem,22rem)] p-0'>
        <div className='flex items-center justify-between border-b border-slate-100 px-3 py-2.5'>
          <p className='text-sm font-semibold text-slate-900'>
            {getUIText('partnerNotif_feedTitle', language)}
          </p>
          {unreadCount > 0 ? (
            <button
              type='button'
              onClick={markAllRead}
              className='text-xs font-medium text-brand hover:text-brand-hover'
            >
              {getUIText('partnerNotif_markAllRead', language)}
            </button>
          ) : null}
        </div>
        <div className='max-h-80 overflow-y-auto'>
          {items.length === 0 ? (
            <p className='px-3 py-6 text-center text-sm text-slate-500'>
              {getUIText('partnerNotif_empty', language)}
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type='button'
                onClick={() => handleOpenItem(item)}
                className={cn(
                  'flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-50',
                  !item.read && 'bg-brand/5',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    kindIconClass(item.kind),
                  )}
                  aria-hidden
                >
                  {item.kind === 'payment_received' ? '฿' : item.kind === 'new_booking' ? '!' : '•'}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium text-slate-900 line-clamp-1'>
                    {item.title}
                  </span>
                  <span className='block text-xs text-slate-600 mt-0.5 line-clamp-2 leading-snug'>
                    {item.body}
                  </span>
                  {item.createdAt ? (
                    <span className='block text-[11px] text-slate-400 mt-1'>
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale })}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className='h-4 w-4 shrink-0 text-slate-300 mt-1' />
              </button>
            ))
          )}
        </div>
        <div className='border-t border-slate-100 px-3 py-2'>
          <Button variant='link' className='h-auto p-0 text-xs text-brand' asChild>
            <Link href='/partner/bookings'>{getUIText('partnerNotif_viewAll', language)}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
