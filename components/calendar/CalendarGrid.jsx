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
  scrollContainerRef
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="relative">
        {/* Scrollable container */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          <div className="inline-flex min-w-full">
            {/* Sticky Listing Column */}
            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 shadow-sm">
              {/* Corner cell */}
              <div className="h-14 border-b border-slate-200 bg-slate-50 flex items-center justify-center px-4">
                <span className="text-xs font-medium text-slate-500">Объект</span>
              </div>
              
              {/* Listing rows */}
              {listings.map((item) => {
                const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
                
                return (
                  <div 
                    key={item.listing.id}
                    className="h-16 border-b border-slate-100 flex items-center gap-3 px-3 hover:bg-slate-50 transition-colors"
                    style={{ minWidth: '200px', maxWidth: '240px' }}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {item.listing.coverImage ? (
                        <ProxiedImage 
                          src={item.listing.coverImage} 
                          alt={item.listing.title}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-900 truncate">
                        {item.listing.title}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
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
              <div className="sticky top-0 z-10 flex bg-slate-50 border-b border-slate-200">
                {dates.map((date) => {
                  const dateObj = parseISO(date)
                  const isCurrentDay = isToday(dateObj)
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                  
                  return (
                    <div 
                      key={date}
                      ref={isCurrentDay ? todayRef : null}
                      className={cn(
                        "h-14 flex flex-col items-center justify-center border-r border-slate-100",
                        isCurrentDay && "bg-teal-50",
                        isWeekend && "bg-slate-100/50"
                      )}
                      style={{ width: dayWidth, minWidth: dayWidth }}
                    >
                      <span className={cn(
                        "text-[10px] uppercase",
                        isCurrentDay ? "text-teal-600 font-bold" : "text-slate-400"
                      )}>
                        {format(dateObj, 'EEE', { locale: ru })}
                      </span>
                      <span className={cn(
                        "text-sm font-medium",
                        isCurrentDay ? "text-teal-600 bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-slate-700"
                      )}>
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
                    
                    // Determine cell appearance
                    let cellClass = STATUS_COLORS.AVAILABLE
                    let content = null
                    
                    if (cellData.status === 'BOOKED') {
                      cellClass = STATUS_COLORS[cellData.bookingStatus] || STATUS_COLORS.CONFIRMED
                      
                      // Show guest name (truncated for first day)
                      if (cellData.isCheckIn || viewMode === 'wide') {
                        content = (
                          <span className="text-[9px] leading-tight truncate px-0.5">
                            {cellData.guestName?.split(' ')[0] || 'Гость'}
                          </span>
                        )
                      }
                    } else if (cellData.status === 'BLOCKED') {
                      cellClass = STATUS_COLORS.BLOCKED
                      if (viewMode === 'wide') {
                        content = (
                          <Lock className="h-3 w-3 text-slate-500" />
                        )
                      }
                    } else if (cellData.status === 'AVAILABLE') {
                      // Show price for available dates
                      const price = cellData.priceThb || item.listing.basePriceThb
                      const basePrice = item.listing.basePriceThb
                      const isHighSeason = price > basePrice
                      const isLowSeason = price < basePrice
                      const minStay = cellData.minStay || 1
                      
                      // Price styling based on season
                      const priceColor = isHighSeason 
                        ? 'text-teal-600 font-bold' 
                        : isLowSeason 
                        ? 'text-slate-400' 
                        : 'text-slate-500'
                      
                      content = (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={cn("text-[10px] leading-tight", priceColor)}>
                            ฿{Math.round(price)}
                          </span>
                          {minStay > 1 && viewMode !== 'compact' && (
                            <span className="text-[8px] text-slate-400 leading-none">
                              min {minStay}
                            </span>
                          )}
                        </div>
                      )
                    }
                    
                    return (
                      <div
                        key={date}
                        onClick={() => onCellClick(item.listing, date, cellData)}
                        className={cn(
                          "h-16 border-r border-b border-slate-100 flex items-center justify-center cursor-pointer transition-all",
                          cellClass,
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
  )
}
