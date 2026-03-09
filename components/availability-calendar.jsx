'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, X, Plus, Loader2, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { format, addDays, differenceInDays, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function AvailabilityCalendar({ listingId, syncErrors = [] }) {
  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  
  // New block form
  const [newBlock, setNewBlock] = useState({
    startDate: null,
    endDate: null,
    reason: ''
  })

  useEffect(() => {
    if (listingId) {
      loadBlocks()
    }
  }, [listingId])

  async function loadBlocks() {
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, {
        credentials: 'include'
      })
      const result = await res.json()
      
      if (result.success) {
        setBlocks(result.blocks || [])
        setBlockedDates(result.blockedDates || [])
      }
    } catch (error) {
      console.error('Failed to load blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function addBlock() {
    if (!newBlock.startDate || !newBlock.endDate) {
      toast.error('Выберите даты')
      return
    }

    setAdding(true)
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startDate: format(newBlock.startDate, 'yyyy-MM-dd'),
          endDate: format(newBlock.endDate, 'yyyy-MM-dd'),
          reason: newBlock.reason || 'Ручная блокировка'
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast.success('Даты заблокированы')
        setNewBlock({ startDate: null, endDate: null, reason: '' })
        loadBlocks()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Ошибка при блокировке дат')
    } finally {
      setAdding(false)
    }
  }

  async function removeBlock(blockId) {
    setDeleting(blockId)
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar?blockId=${blockId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast.success('Блокировка удалена')
        loadBlocks()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Ошибка при удалении')
    } finally {
      setDeleting(null)
    }
  }

  // Separate manual and ical blocks
  const manualBlocks = blocks.filter(b => b.source === 'manual')
  const icalBlocks = blocks.filter(b => b.source !== 'manual')

  // Calculate disabled dates for calendar (already blocked)
  const disabledDates = blockedDates.map(d => parseISO(d))

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sync Error Warning */}
      {syncErrors.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Ошибка синхронизации календаря</p>
                <p className="text-sm text-amber-700 mt-1">
                  Последняя синхронизация с внешними календарями завершилась с ошибкой. 
                  Проверьте настройки iCal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Заблокировать даты
          </CardTitle>
          <CardDescription>
            Заблокируйте даты для личного использования или внешних бронирований
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Начало</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newBlock.startDate 
                        ? format(newBlock.startDate, 'd MMM yyyy', { locale: ru })
                        : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newBlock.startDate}
                      onSelect={(date) => setNewBlock(prev => ({ 
                        ...prev, 
                        startDate: date,
                        endDate: prev.endDate && date > prev.endDate ? date : prev.endDate
                      }))}
                      disabled={(date) => date < new Date() || disabledDates.some(d => 
                        d.toDateString() === date.toDateString()
                      )}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Конец</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newBlock.endDate 
                        ? format(newBlock.endDate, 'd MMM yyyy', { locale: ru })
                        : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newBlock.endDate}
                      onSelect={(date) => setNewBlock(prev => ({ ...prev, endDate: date }))}
                      disabled={(date) => {
                        if (!newBlock.startDate) return true
                        if (date < newBlock.startDate) return true
                        return disabledDates.some(d => d.toDateString() === date.toDateString())
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Причина (необязательно)</Label>
              <Input
                placeholder="Например: личное бронирование, ремонт..."
                value={newBlock.reason}
                onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            {/* Summary & Submit */}
            {newBlock.startDate && newBlock.endDate && (
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">
                    {differenceInDays(newBlock.endDate, newBlock.startDate) + 1}
                  </span> дней будет заблокировано
                </div>
                <Button 
                  onClick={addBlock}
                  disabled={adding}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Заблокировать
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Blocks List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ручные блокировки</CardTitle>
          <CardDescription>
            Даты, которые вы заблокировали вручную
          </CardDescription>
        </CardHeader>
        <CardContent>
          {manualBlocks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Нет ручных блокировок
            </p>
          ) : (
            <div className="space-y-2">
              {manualBlocks.map(block => (
                <div 
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium">
                        {format(parseISO(block.start_date), 'd MMM', { locale: ru })} — {format(parseISO(block.end_date), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {differenceInDays(parseISO(block.end_date), parseISO(block.start_date)) + 1} дн.
                      </Badge>
                    </div>
                    {block.reason && (
                      <p className="text-xs text-slate-500 mt-1 ml-6">{block.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(block.id)}
                    disabled={deleting === block.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deleting === block.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* iCal Blocks (read-only) */}
      {icalBlocks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Синхронизировано из iCal</CardTitle>
            <CardDescription>
              Автоматически импортировано из внешних календарей
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {icalBlocks.slice(0, 10).map(block => (
                <div 
                  key={block.id}
                  className="flex items-center p-3 bg-blue-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-900">
                        {format(parseISO(block.start_date), 'd MMM', { locale: ru })} — {format(parseISO(block.end_date), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">iCal</Badge>
                    </div>
                    {block.reason && (
                      <p className="text-xs text-blue-600 mt-1 ml-6">{block.reason}</p>
                    )}
                  </div>
                </div>
              ))}
              {icalBlocks.length > 10 && (
                <p className="text-xs text-slate-500 text-center">
                  + ещё {icalBlocks.length - 10} записей
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
