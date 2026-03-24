/**
 * CalendarHeader Component
 * Navigation, controls, and legend for Partner Calendar
 */

'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  DollarSign,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function LegendBody({ variant = 'inline' }) {
  const wrap = variant === 'stacked' ? 'flex flex-col gap-2.5' : 'flex items-center gap-4 flex-wrap'
  return (
    <div className={`${wrap} text-xs`}>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded bg-teal-500 shrink-0" />
        <span className="text-slate-600">Подтверждено</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded bg-amber-400 shrink-0" />
        <span className="text-slate-600">Ожидание</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded bg-slate-300 shrink-0" />
        <span className="text-slate-600">Заблокировано</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded border-2 border-dashed border-teal-400 shrink-0" />
        <span className="text-slate-600">Check-in/out</span>
      </div>
      <div className="h-4 w-px bg-slate-300 hidden sm:block" aria-hidden />
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-teal-600">฿</span>
        <span className="text-slate-600">Высокий сезон</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">฿</span>
        <span className="text-slate-600">Низкий сезон</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">฿</span>
        <span className="text-slate-600">Базовая цена</span>
      </div>
    </div>
  )
}

export function CalendarHeader({
  startDate,
  endDate,
  viewMode,
  summary,
  onToday,
  onBack,
  onForward,
  onViewModeChange,
  onRefresh,
  onPriceModalOpen,
}) {
  const [legendOpen, setLegendOpen] = useState(false)

  return (
    <>
      {/* Title and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-teal-600" />
            Мастер-Календарь
          </h1>
          <p className="text-slate-600 mt-1">
            {summary?.totalListings || 0} объектов • {summary?.totalBookings || 0} бронирований
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onPriceModalOpen}
            className="bg-teal-600 text-white hover:bg-teal-700 border-0"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Установить цены
          </Button>

          <Button variant="outline" size="sm" onClick={onToday} className="text-teal-600 border-teal-200 hover:bg-teal-50">
            Сегодня
          </Button>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium text-slate-700 min-w-[140px] text-center">
              {format(parseISO(startDate), 'd MMM', { locale: ru })} —{' '}
              {format(parseISO(endDate), 'd MMM yyyy', { locale: ru })}
            </span>
            <Button variant="ghost" size="sm" onClick={onForward} className="rounded-none">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('compact')}
              className="rounded-none"
              title="Компактный вид"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'wide' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('wide')}
              className="rounded-none"
              title="Широкий вид"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onRefresh} title="Обновить">
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Мобильная легенда — компактная кнопка */}
          <div className="sm:hidden">
            <Popover open={legendOpen} onOpenChange={setLegendOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 border-slate-200" title="Легенда">
                  <Info className="h-4 w-4 text-slate-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(calc(100vw-1.5rem),20rem)] p-3 sm:p-4">
                <p className="text-xs font-semibold text-slate-800 mb-2">Обозначения</p>
                <LegendBody variant="stacked" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Легенда: только sm+ */}
      <div className="hidden sm:block mb-4">
        <LegendBody />
      </div>
    </>
  )
}
