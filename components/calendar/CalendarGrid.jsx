/**
 * CalendarGrid Component
 * Main calendar grid with sticky columns and booking cells
 */

'use client'

import { format, parseISO, isToday } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Home, Anchor, Bike, Car, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Type icons
const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home
}

// Status colors
const STATUS_COLORS = {
  CONFIRMED: 'bg-teal-500 text-white',
  PENDING: 'bg-amber-400 text-amber-900',
  PAID: 'bg-emerald-500 text-white',
  BLOCKED: 'bg-slate-300 text-slate-600',
  AVAILABLE: 'bg-white hover:bg-slate-50'
}

export function CalendarGrid({
  dates,
  listings,
  dayWidth,
  viewMode,
  onCellClick,
  todayRef,
  scrollContainerRef,
  /** В модалках/шитах задайте меньше (например min(60vh, 420px)), иначе пустота снизу */
  scrollMaxHeight = 'calc(100vh - 280px)',
}) {
  return (
    <TooltipProvider>
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative">
        {/* Scrollable container */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{ maxHeight: scrollMaxHeight }}
        >
          <div className="inline-flex min-w-full">
            {/* Sticky Listing Column */}
            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 shadow-sm">
              {/* Corner cell */}
              <div className="flex h-16 items-center justify-center border-b border-slate-200 bg-slate-50 px-4">
                <span className="text-sm font-semibold text-slate-600">Объект</span>
              </div>
              
              {/* Listing rows */}
              {listings.map((item) => {
                const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
                
                return (
                  <div 
                    key={item.listing.id}
                    className="flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50"
                    style={{ minWidth: '220px', maxWidth: '260px' }}
                  >
                    {/* Thumbnail */}
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
                    
                    {/* Info */}
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
            
            {/* Date columns */}
            <div className="flex-1">
              {/* Sticky Date Header */}
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
                        isCurrentDay && "bg-teal-50",
                        isWeekend && "bg-slate-100/50"
                      )}
                      style={{ width: dayWidth, minWidth: dayWidth }}
                    >
                      <span
                        className={cn(
                          'text-[11px] font-semibold uppercase tracking-wide',
                          isCurrentDay ? 'font-bold text-teal-700' : 'text-slate-500',
                        )}
                      >
                        {format(dateObj, 'EEE', { locale: ru })}
                      </span>
                      <span
                        className={cn(
                          'text-base font-bold',
                          isCurrentDay
                            ? 'flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-sm text-white'
                            : 'text-slate-800',
                        )}
                      >
                        {format(dateObj, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>
              
              {/* Data rows */}
              {listings.map((item) => (
                <div key={item.listing.id} className="flex">
                  {dates.map((date) => {
                    const cellData = item.availability[date] || { status: 'AVAILABLE' }
                    const isCurrentDay = isToday(parseISO(date))
                    const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6
                    const flashSaleDay =
                      cellData.status === 'AVAILABLE' && cellData.marketingPromo?.isFlashSale === true
                    
                    // Determine cell appearance
                    let cellClass = STATUS_COLORS.AVAILABLE
                    let content = null
                    
                    if (cellData.status === 'BOOKED') {
                      cellClass = STATUS_COLORS[cellData.bookingStatus] || STATUS_COLORS.CONFIRMED
                      
                      // Show guest name (truncated for first day)
                      if (cellData.isCheckIn || viewMode === 'wide') {
                        content = (
                          <span className="truncate px-0.5 text-[10px] font-semibold leading-tight">
                            {cellData.guestName?.split(' ')[0] || 'Гость'}
                          </span>
                        )
                      }
                    } else if (cellData.status === 'BLOCKED') {
                      cellClass = STATUS_COLORS.BLOCKED
                      if (viewMode === 'wide') {
                        content = (
                          <Lock className="h-4 w-4 text-slate-600" />
                        )
                      }
                    } else if (cellData.status === 'AVAILABLE') {
                      // Show price for available dates
                      const price = cellData.priceThb || item.listing.basePriceThb
                      const basePrice = item.listing.basePriceThb
                      const isHighSeason = price > basePrice
                      const isLowSeason = price < basePrice
                      const minStay = cellData.minStay || 1
                      const marketingPromo = cellData.marketingPromo || null
                      
                      // Price styling based on season
                      const priceColor = isHighSeason 
                        ? 'text-teal-600 font-bold' 
                        : isLowSeason 
                        ? 'text-slate-400' 
                        : 'text-slate-500'
                      
                      content = (
                        <div className="flex flex-col items-center justify-center gap-0.5 px-0.5">
                          <span className={cn('text-xs font-bold tabular-nums leading-tight', priceColor)}>
                            ฿{Math.round(price).toLocaleString('en-US')}
                          </span>
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
                                  {marketingPromo.isFlashSale ? 'FLASH' : 'PROMO'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] leading-relaxed">
                                <p className="font-semibold">{marketingPromo.code || 'PROMO'}</p>
                                <p>
                                  ฿{Math.round(marketingPromo.baseSeasonPrice || price).toLocaleString('en-US')} - ฿
                                  {Math.round(marketingPromo.discountAmount || 0).toLocaleString('en-US')} = ฿
                                  {Math.round(marketingPromo.guestPrice || price).toLocaleString('en-US')}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          {minStay > 1 && viewMode !== 'compact' && (
                            <span className="text-[9px] font-medium leading-none text-slate-500">мин {minStay}</span>
                          )}
                        </div>
                      )
                    }
                    
                    return (
                      <div
                        key={date}
                        onClick={() => onCellClick(item.listing, date, cellData)}
                        className={cn(
                          'relative flex min-h-[72px] cursor-pointer items-center justify-center border-b border-r border-slate-100 transition-all',
                          cellClass,
                          flashSaleDay &&
                            !isCurrentDay &&
                            'shadow-[inset_0_0_0_1px_rgba(249,115,22,0.5)]',
                          isCurrentDay && "ring-2 ring-inset ring-teal-400",
                          isWeekend && cellData.status === 'AVAILABLE' && "bg-slate-50",
                          cellData.isTransition && "border-l-2 border-l-dashed border-l-teal-400",
                          cellData.isCheckIn && "rounded-l",
                          cellData.isCheckOut && "rounded-r"
                        )}
                        style={{ width: dayWidth, minWidth: dayWidth }}
                        title={cellData.status === 'BOOKED' 
                          ? `${cellData.guestName} (${cellData.bookingStatus})`
                          : cellData.status === 'BLOCKED'
                          ? cellData.reason
                          : cellData.previousGuestName
                          ? `Выезд ${cellData.previousGuestName} — можно бронировать заезд`
                          : 'Доступно - нажмите для действия'
                        }
                      >
                        {flashSaleDay ? (
                          <span
                            className="pointer-events-none absolute right-1 top-1 z-[1] h-2 w-2 rounded-full bg-orange-500 shadow-sm ring-2 ring-white"
                            title="Flash Sale"
                            aria-hidden
                          />
                        ) : null}
                        {content}
                      </div>
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
