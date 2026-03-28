'use client'

/**
 * Вертикальный режим мастер-календаря для узких экранов (< md).
 * Без горизонтального скролла всей таблицы: дни списком, крупные тапы.
 */

import { format, parseISO, isToday as isDateToday } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Home, Anchor, Bike, Car, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'

const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home,
}

const STATUS_BADGE = {
  CONFIRMED: 'bg-teal-600 text-white',
  PENDING: 'bg-amber-400 text-amber-950',
  PAID: 'bg-emerald-600 text-white',
  BLOCKED: 'bg-slate-400 text-white',
  AVAILABLE: 'bg-slate-100 text-slate-800 border border-slate-200',
}

export function CalendarMobileAgenda({ dates, listings, onCellClick, bare = false }) {
  const inner = (
    <div className="divide-y divide-slate-200">
        {listings.map((item) => {
          const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
          return (
            <section key={item.listing.id} className="bg-white">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {item.listing.coverImage ? (
                    <ProxiedImage
                      src={item.listing.coverImage}
                      alt={item.listing.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <TypeIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-tight text-slate-900">{item.listing.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                    <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                    {item.listing.district}
                  </p>
                </div>
              </div>

              <ul className="px-0">
                {dates.map((date) => (
                  <AgendaRow
                    key={`${item.listing.id}-${date}`}
                    date={date}
                    item={item}
                    onCellClick={onCellClick}
                  />
                ))}
              </ul>
            </section>
          )
        })}
    </div>
  )

  if (bare) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{inner}</div>
    )
  }

  return <Card className="overflow-hidden border-0 shadow-lg">{inner}</Card>
}

function AgendaRow({ date, item, onCellClick }) {
  const cellData = item.availability[date] || { status: 'AVAILABLE' }
  const dateObj = parseISO(date)
  const today = isDateToday(dateObj)
  const weekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

  let badgeClass = STATUS_BADGE.AVAILABLE
  let label = 'Свободно'
  let sub = null
  let priceLine = null

  if (cellData.status === 'BOOKED') {
    badgeClass = STATUS_BADGE[cellData.bookingStatus] || STATUS_BADGE.CONFIRMED
    label = cellData.bookingStatus === 'PENDING' ? 'Ожидает' : cellData.bookingStatus === 'PAID' ? 'Оплачено' : 'Бронь'
    sub = cellData.guestName || 'Гость'
  } else if (cellData.status === 'BLOCKED') {
    badgeClass = STATUS_BADGE.BLOCKED
    label = 'Закрыто'
    sub = cellData.reason ? String(cellData.reason).slice(0, 42) : null
  } else {
    const price = cellData.priceThb || item.listing.basePriceThb
    const basePrice = item.listing.basePriceThb
    const high = price > basePrice
    const low = price < basePrice
    const minStay = cellData.minStay || 1
    priceLine = (
      <div className="text-right">
        <span
          className={cn(
            'text-xl font-bold tabular-nums tracking-tight',
            high && 'text-teal-700',
            low && 'text-slate-500',
            !high && !low && 'text-slate-900',
          )}
        >
          ฿{Math.round(price).toLocaleString('en-US')}
        </span>
        {minStay > 1 ? (
          <p className="text-xs font-medium text-slate-500">мин. {minStay} ноч.</p>
        ) : null}
      </div>
    )
    label = 'Свободно'
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onCellClick(item.listing, date, cellData)}
        className={cn(
          'flex w-full min-h-[60px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors',
          'touch-manipulation active:bg-slate-100',
          today && 'bg-teal-50/80 ring-2 ring-inset ring-teal-400/60',
          weekend && cellData.status === 'AVAILABLE' && !today && 'bg-slate-50/50',
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-bold',
            today ? 'border-teal-600 bg-white text-teal-800' : 'border-slate-200 bg-white text-slate-800',
          )}
        >
          <span className="text-[10px] font-semibold uppercase leading-none text-slate-500">
            {format(dateObj, 'EEE', { locale: ru })}
          </span>
          <span className="text-xl leading-none">{format(dateObj, 'd')}</span>
          <span className="text-[9px] font-medium text-slate-500">{format(dateObj, 'MMM', { locale: ru })}</span>
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
              badgeClass,
            )}
          >
            {label}
          </span>
          {sub ? <p className="mt-1 truncate text-sm font-semibold text-slate-800">{sub}</p> : null}
        </div>

        {priceLine ? <div className="shrink-0 pl-2">{priceLine}</div> : null}

        {cellData.status === 'BLOCKED' && !priceLine ? (
          <div className="shrink-0 text-slate-500">
            <Lock className="h-6 w-6" aria-hidden />
          </div>
        ) : null}
      </button>
    </li>
  )
}
