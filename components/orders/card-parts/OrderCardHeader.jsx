'use client'

import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProxiedImage } from '@/components/proxied-image'
import { Calendar, Home, MapPin } from 'lucide-react'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'
import { OrderCardStatusBadge } from '@/components/orders/card-parts/OrderCardStatusBadge'
import { normalizeOrderType } from '@/lib/orders/order-timeline'

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
}) {
  const normalizedType = normalizeOrderType(orderType)

  return (
    <CardHeader>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
          {listingImage ? (
            <ProxiedImage src={listingImage} alt={title} fill className="object-cover" sizes="96px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="h-8 w-8 text-slate-300" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <OrderTypeIcon type={normalizedType} className="text-teal-700 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700 truncate">
                {orderTypeLabel}
              </span>
            </div>
            <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span>{formatOrderDateRange(checkIn, checkOut, language)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span>{district ? `${district}, Thailand` : 'Thailand'}</span>
              </div>
              {bookingId && orderRefTemplate ? (
                <p className="text-xs text-slate-500 pt-0.5">
                  {orderRefTemplate.replace(/\{\{id\}\}/g, String(bookingId))}
                </p>
              ) : null}
            </CardDescription>
          </div>
          <OrderCardStatusBadge status={status} language={language} className="shrink-0" />
        </div>
      </div>
    </CardHeader>
  )
}
