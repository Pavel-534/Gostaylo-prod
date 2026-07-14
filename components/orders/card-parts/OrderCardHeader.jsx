'use client'

import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProxiedImage } from '@/components/proxied-image'
import { Calendar, Home, MapPin } from 'lucide-react'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'
import { OrderCardStatusBadge } from '@/components/orders/card-parts/OrderCardStatusBadge'
import { normalizeOrderType } from '@/lib/orders/order-timeline'
import { cn } from '@/lib/utils'

function dateLocaleForLanguage(language) {
  const lang = String(language || 'ru').toLowerCase()
  if (lang === 'en') return 'en-US'
  if (lang === 'th') return 'th-TH'
  if (lang === 'zh') return 'zh-CN'
  return 'ru-RU'
}

function formatOrderDateRange(checkIn, checkOut, language) {
  if (!checkIn || !checkOut) return '—'
  const locale = dateLocaleForLanguage(language)
  const a = new Date(checkIn)
  const b = new Date(checkOut)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—'
  return `${a.toLocaleDateString(locale)} — ${b.toLocaleDateString(locale)}`
}

/**
 * Listing cover, service type, title, dates, location, order ref, status badge.
 * @param {'default' | 'drawer'} [variant] — drawer: stack image on mobile, omit duplicate title.
 */
export function OrderCardHeader({
  listingImage,
  title,
  district,
  checkIn,
  checkOut,
  orderType,
  orderTypeLabel,
  bookingId,
  status,
  language,
  orderRefTemplate,
  variant = 'default',
}) {
  const normalizedType = normalizeOrderType(orderType)
  const isDrawer = variant === 'drawer'

  return (
    <CardHeader className={isDrawer ? 'p-0 pb-3' : undefined}>
      <div
        className={cn(
          'flex gap-3',
          isDrawer ? 'flex-col sm:flex-row sm:items-start sm:gap-4' : 'items-start sm:gap-4',
        )}
      >
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100',
            isDrawer
              ? 'aspect-[2/1] w-full max-h-36 sm:h-24 sm:w-24 sm:max-h-none sm:aspect-auto'
              : 'h-20 w-20 sm:h-24 sm:w-24',
          )}
        >
          {listingImage ? (
            <ProxiedImage
              src={listingImage}
              alt={title}
              fill
              className="object-cover"
              sizes={isDrawer ? '100vw' : '96px'}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Home className="h-8 w-8 text-slate-300" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 w-full space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <OrderCardStatusBadge status={status} language={language} className="shrink-0" />
            <div className="flex min-w-0 items-center gap-1.5">
              <OrderTypeIcon type={normalizedType} className="shrink-0 text-brand-hover" />
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-brand-hover">
                {orderTypeLabel}
              </span>
            </div>
          </div>

          {!isDrawer ? (
            <CardTitle className="break-words text-lg leading-snug md:text-xl">{title}</CardTitle>
          ) : null}

          <CardDescription className={cn('space-y-1', isDrawer ? 'mt-0' : 'mt-2')}>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              <span className="break-words">{formatOrderDateRange(checkIn, checkOut, language)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span className="break-words">{district ? `${district}, Thailand` : 'Thailand'}</span>
            </div>
            {bookingId && orderRefTemplate ? (
              <p className="pt-0.5 text-xs text-slate-500 break-all">
                {orderRefTemplate.replace(/\{\{id\}\}/g, String(bookingId))}
              </p>
            ) : null}
          </CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}
