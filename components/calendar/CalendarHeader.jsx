/**
 * CalendarHeader Component
 * Navigation, controls, and legend for Partner Calendar
 */

'use client'

import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { 
  ChevronLeft, ChevronRight, CalendarDays, 
  DollarSign, RefreshCw, ZoomIn, ZoomOut 
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  onPriceModalOpen
}) {
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
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={onToday}
            className="text-teal-600 border-teal-200 hover:bg-teal-50"
          >
            Сегодня
          </Button>
          
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium text-slate-700 min-w-[140px] text-center">
              {format(parseISO(startDate), 'd MMM', { locale: ru })} — {format(parseISO(endDate), 'd MMM yyyy', { locale: ru })}
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
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onRefresh}
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-teal-500"></div>
          <span className="text-slate-600">Подтверждено</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-400"></div>
          <span className="text-slate-600">Ожидание</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-300"></div>
          <span className="text-slate-600">Заблокировано</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-dashed border-teal-400"></div>
          <span className="text-slate-600">Check-in/out</span>
        </div>
        <div className="h-4 w-px bg-slate-300"></div>
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
    </>
  )
}
