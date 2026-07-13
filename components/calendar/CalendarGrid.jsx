/**
 * CalendarGrid Component
 * Main calendar grid with sticky columns and booking cells
 */

'use client'

import { format, parseISO, isToday } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { Home, Anchor, Bike, Car, Lock, CalendarSync, Receipt, MessageCircle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getUIText } from '@/lib/translations'
import {
  CalendarListingPriceDisplay,
  useCalendarListingPriceFormat,
} from '@/components/calendar/calendar-listing-price-display'
import {
  BLOCK_DISPLAY_KIND,
  buildBlockedCellTitle,
  formatBlockExpiresAt,
  resolveBlockedCellClass,
  resolveBookingStatusCellClass,
  isSoftHoldDisplayKind,
} from '@/lib/calendar/calendar-cell-presentation.js'

const DATE_FNS_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

function trTpl(template, vars) {
  let s = String(template || '')
  for (const [k, v] of Object.entries(vars || {})) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}

const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home,
}

const STATUS_COLORS = {
  AVAILABLE: 'bg-white hover:bg-slate-50',
}

function blockedCellIcon(kind) {
  if (kind === BLOCK_DISPLAY_KIND.ICAL) return CalendarSync
  if (kind === BLOCK_DISPLAY_KIND.INVOICE_HOLD) return Receipt
  if (kind === BLOCK_DISPLAY_KIND.INQUIRY_HOLD) return MessageCircle
  return Lock
}

function blockedCellChipKey(kind) {
  if (kind === BLOCK_DISPLAY_KIND.ICAL) return 'partnerCal_chipIcal'
  if (kind === BLOCK_DISPLAY_KIND.INVOICE_HOLD) return 'partnerCal_chipInvoice'
  if (kind === BLOCK_DISPLAY_KIND.INQUIRY_HOLD) return 'partnerCal_chipInquiry'
  return 'partnerCal_chipManual'
}

export function CalendarGrid({
  dates,
  listings,
  dayWidth,
  viewMode,
  onCellClick,
  todayRef,
  scrollContainerRef,
  language = 'ru',
  scrollMaxHeight = 'calc(100vh - 280px)',
}) {
  const t = (key) => getUIText(key, language)
  const dfLocale = DATE_FNS_LOCALE[language] || ru
  const { formatListingPrice } = useCalendarListingPriceFormat()
  const resolveListingBaseCurrency = (listing) =>
    String(listing?.baseCurrency || listing?.base_currency || 'THB').toUpperCase()

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{ maxHeight: scrollMaxHeight }}
        >
          <div className="inline-flex min-w-full">
            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 shadow-sm">
              <div className="flex h-16 items-center justify-center border-b border-slate-200 bg-slate-50 px-4">
                <span className="text-sm font-semibold text-slate-600">{t('partnerCal_gridColumnListing')}</span>
              </div>

              {listings.map((item) => {
                const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default

                return (
                  <div
                    key={item.listing.id}
                    className="flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50"
                    style={{ minWidth: '220px', maxWidth: '260px' }}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.listing.coverImage ? (
                        <ProxiedImage
                          src={item.listing.coverImage}
                          alt={item.listing.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-base font-semibold text-slate-900">
                        {item.listing.title}
                      </h4>
                      <p className="flex items-center gap-1 text-sm text-slate-600">
                        <TypeIcon className="h-3 w-3" />
                        {item.listing.district}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex-1">
              <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50">
                {dates.map((date) => {
                  const dateObj = parseISO(date)
                  const isCurrentDay = isToday(dateObj)
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

                  return (
                    <div
                      key={date}
                      ref={isCurrentDay && todayRef ? todayRef : undefined}
                      className={cn(
                        'flex h-16 flex-col items-center justify-center border-r border-slate-100',
                        isCurrentDay && 'bg-brand/10',
                        isWeekend && 'bg-slate-100/50',
                      )}
                      style={{ width: dayWidth, minWidth: dayWidth }}
                    >
                      <span
                        className={cn(
                          'text-[11px] font-semibold uppercase tracking-wide',
                          isCurrentDay ? 'font-bold text-brand-hover' : 'text-slate-500',
                        )}
                      >
                        {format(dateObj, 'EEE', { locale: dfLocale })}
                      </span>
                      <span
                        className={cn(
                          'text-base font-bold',
                          isCurrentDay
                            ? 'flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm text-white'
                            : 'text-slate-800',
                        )}
                      >
                        {format(dateObj, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {listings.map((item) => (
                <div key={item.listing.id} className="flex">
                  {dates.map((date) => {
                    const cellData = item.availability[date] || { status: 'AVAILABLE' }
                    const isCurrentDay = isToday(parseISO(date))
                    const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6
                    const flashSaleDay =
                      cellData.status === 'AVAILABLE' && cellData.marketingPromo?.isFlashSale === true

                    let cellClass = STATUS_COLORS.AVAILABLE
                    let content = null
                    let blockKind = null

                    if (cellData.status === 'BOOKED') {
                      cellClass = resolveBookingStatusCellClass(cellData.bookingStatus)

                      if (cellData.isCheckIn || viewMode === 'wide') {
                        content = (
                          <span className="truncate px-0.5 text-[10px] font-semibold leading-tight">
                            {cellData.guestName?.split(' ')[0] || t('partnerCal_guestShort')}
                          </span>
                        )
                      }
                    } else if (cellData.status === 'BLOCKED') {
                      cellClass = resolveBlockedCellClass(cellData)
                      blockKind = cellData.blockKind
                      const Icon = blockedCellIcon(blockKind)

                      if (viewMode === 'wide') {
                        content = <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      } else if (
                        blockKind === BLOCK_DISPLAY_KIND.ICAL ||
                        blockKind === BLOCK_DISPLAY_KIND.INVOICE_HOLD ||
                        blockKind === BLOCK_DISPLAY_KIND.INQUIRY_HOLD
                      ) {
                        content = (
                          <span className="text-[9px] font-bold uppercase tracking-wide">
                            {t(blockedCellChipKey(blockKind))}
                          </span>
                        )
                      }
                    } else if (cellData.status === 'AVAILABLE') {
                      const price = cellData.priceThb || item.listing.basePriceThb
                      const basePrice = item.listing.basePriceThb
                      const isHighSeason = price > basePrice
                      const isLowSeason = price < basePrice
                      const minStay = cellData.minStay || 1
                      const marketingPromo = cellData.marketingPromo || null

                      const priceColor = isHighSeason
                        ? 'text-brand font-bold'
                        : isLowSeason
                          ? 'text-slate-400'
                          : 'text-slate-500'

                      const baseCur = resolveListingBaseCurrency(item.listing)
                      const promoBase = formatListingPrice(
                        marketingPromo.baseSeasonPrice || price,
                        baseCur,
                      )
                      const promoDiscount = formatListingPrice(marketingPromo.discountAmount || 0, baseCur)
                      const promoGuest = formatListingPrice(marketingPromo.guestPrice || price, baseCur)

                      content = (
                        <div className="flex flex-col items-center justify-center gap-0.5 px-0.5">
                          <CalendarListingPriceDisplay
                            amountThb={price}
                            baseCurrency={baseCur}
                            priceClassName={cn('text-xs font-bold tabular-nums leading-tight', priceColor)}
                          />
                          {marketingPromo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    'inline-flex max-w-full cursor-help items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none',
                                    marketingPromo.isFlashSale
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-indigo-100 text-indigo-700',
                                  )}
                                >
                                  {marketingPromo.isFlashSale ? t('partnerCal_chipFlash') : t('partnerCal_chipPromo')}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] leading-relaxed">
                                <p className="font-semibold">{marketingPromo.code || 'PROMO'}</p>
                                <p>
                                  {trTpl(t('partnerCal_tooltipPromoLine'), {
                                    base: promoBase.primary,
                                    discount: promoDiscount.primary,
                                    guest: promoGuest.primary,
                                  })}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          {minStay > 1 && viewMode !== 'compact' && (
                            <span className="text-[9px] font-medium leading-none text-slate-500">
                              {trTpl(t('partnerCal_minStayShort'), { n: minStay })}
                            </span>
                          )}
                        </div>
                      )
                    }

                    const cellTitle =
                      cellData.status === 'BOOKED'
                        ? trTpl(t('partnerCal_cellTitleBooked'), {
                            name: cellData.guestName || t('partnerCal_guestShort'),
                            status: cellData.bookingStatus || '',
                          })
                        : cellData.status === 'BLOCKED'
                          ? buildBlockedCellTitle(cellData, t, trTpl, language)
                          : cellData.previousGuestName
                            ? trTpl(t('partnerCal_cellTitleCheckout'), {
                                name: cellData.previousGuestName,
                              })
                            : t('partnerCal_cellTitleAvailable')

                    const showHoldTooltip =
                      cellData.status === 'BLOCKED' &&
                      isSoftHoldDisplayKind(cellData.blockKind) &&
                      cellData.blockExpiresAt

                    const cellInner = (
                      <div
                        key={date}
                        onClick={() => onCellClick(item.listing, date, cellData)}
                        className={cn(
                          'relative flex min-h-[72px] cursor-pointer items-center justify-center border-b border-r border-slate-100 transition-all',
                          cellClass,
                          flashSaleDay &&
                            !isCurrentDay &&
                            'shadow-[inset_0_0_0_1px_rgba(249,115,22,0.5)]',
                          isCurrentDay && 'ring-2 ring-inset ring-brand/40',
                          isWeekend && cellData.status === 'AVAILABLE' && 'bg-slate-50',
                          cellData.isTransition && 'border-l-2 border-l-dashed border-l-brand/40',
                          cellData.isCheckIn && 'rounded-l',
                          cellData.isCheckOut && 'rounded-r',
                        )}
                        style={{ width: dayWidth, minWidth: dayWidth }}
                        title={showHoldTooltip ? undefined : cellTitle}
                      >
                        {flashSaleDay ? (
                          <span
                            className="pointer-events-none absolute right-1 top-1 z-[1] h-2 w-2 rounded-full bg-orange-500 shadow-sm ring-2 ring-white"
                            title={t('partnerCal_chipFlash')}
                            aria-hidden
                          />
                        ) : null}
                        {content}
                      </div>
                    )

                    if (!showHoldTooltip) return cellInner

                    return (
                      <Tooltip key={date}>
                        <TooltipTrigger asChild>{cellInner}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] leading-relaxed">
                          <p className="font-semibold">{cellTitle}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {trTpl(t('partnerCal_holdExpiresAt'), {
                              expires: formatBlockExpiresAt(cellData.blockExpiresAt, language),
                            })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </Card>
    </TooltipProvider>
  )
}
