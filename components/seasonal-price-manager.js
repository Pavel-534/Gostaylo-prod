'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { getSeasonColor } from '@/lib/price-calculator'
import 'react-day-picker/dist/style.css'

const SEASON_TYPES = [
  { value: 'LOW', label: 'Низкий сезон', color: 'green' },
  { value: 'NORMAL', label: 'Обычный', color: 'slate' },
  { value: 'HIGH', label: 'Высокий сезон', color: 'orange' },
  { value: 'PEAK', label: 'Пик', color: 'red' },
]

export default function SeasonalPriceManager({ listingId, basePriceThb }) {
  const [seasonalPrices, setSeasonalPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [formData, setFormData] = useState({
    label: '',
    seasonType: 'NORMAL',
    priceDaily: '',
    priceMonthly: '',
    description: '',
  })

  useEffect(() => {
    loadSeasonalPrices()
  }, [listingId])

  async function loadSeasonalPrices() {
    try {
      const res = await fetch(`/api/v2/partner/seasonal-prices?listingId=${listingId}`, { credentials: 'include' })
      const data = await res.json()
      
      if (data.status === 'success' || data.success) {
        const raw = data.data || []
        setSeasonalPrices(raw.map(sp => ({
          id: sp.id,
          startDate: sp.start_date || sp.startDate,
          endDate: sp.end_date || sp.endDate,
          label: sp.label,
          seasonType: sp.season_type || sp.seasonType,
          priceDaily: sp.price_daily ?? sp.priceDaily,
          priceMonthly: sp.price_monthly ?? sp.priceMonthly,
          description: sp.description
        })))
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load seasonal prices:', error)
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingPrice(null)
    setDateRange({ from: null, to: null })
    setFormData({
      label: '',
      seasonType: 'NORMAL',
      priceDaily: '',
      priceMonthly: '',
      description: '',
    })
    setModalOpen(true)
  }

  function openEditModal(price) {
    setEditingPrice(price)
    setDateRange({
      from: new Date(price.startDate),
      to: new Date(price.endDate),
    })
    setFormData({
      label: price.label,
      seasonType: price.seasonType,
      priceDaily: price.priceDaily.toString(),
      priceMonthly: price.priceMonthly?.toString() || '',
      description: price.description || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    // Validation
    if (!dateRange.from || !dateRange.to) {
      toast.error('Выберите диапазон дат')
      return
    }
    
    if (!formData.label.trim()) {
      toast.error('Введите название сезона')
      return
    }
    
    if (!formData.priceDaily || parseFloat(formData.priceDaily) <= 0) {
      toast.error('Введите дневную цену')
      return
    }
    
    setSaving(true)
    
    try {
      const payload = {
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        label: formData.label,
        seasonType: formData.seasonType,
        priceDaily: parseFloat(formData.priceDaily),
        priceMonthly: formData.priceMonthly ? parseFloat(formData.priceMonthly) : null,
        description: formData.description,
      }
      
      const res = editingPrice
        ? await (async () => {
            await fetch(`/api/v2/partner/seasonal-prices?id=${editingPrice.id}`, {
              method: 'DELETE',
              credentials: 'include',
            })
            return fetch('/api/v2/partner/seasonal-prices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ ...payload, listingId }),
            })
          })()
        : await fetch('/api/v2/partner/seasonal-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ...payload, listingId }),
          })
      
      const data = await res.json()
      
      if (data.status === 'success' || data.success) {
        toast.success(editingPrice ? 'Сезон обновлён' : 'Сезон создан')
        setModalOpen(false)
        loadSeasonalPrices()
      } else {
        toast.error(data.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save seasonal price:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(priceId) {
    if (!confirm('Удалить этот сезонный период?')) return
    
    try {
      const res = await fetch(`/api/v2/partner/seasonal-prices?id=${priceId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (data.status === 'success' || data.success) {
        toast.success('Сезон удалён')
        loadSeasonalPrices()
      } else {
        toast.error(data.error || 'Ошибка при удалении')
      }
    } catch (error) {
      console.error('Failed to delete seasonal price:', error)
      toast.error('Ошибка при удалении')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-600" />
                Сезонные цены
              </CardTitle>
              <CardDescription className="mt-2">
                Установите разные цены для разных периодов года. Базовая цена: <strong>{basePriceThb?.toLocaleString('ru-RU')} ₿/день</strong>
              </CardDescription>
            </div>
            <Button onClick={openCreateModal} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Добавить сезон
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {seasonalPrices.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-2">Сезонные цены не настроены</p>
              <p className="text-sm text-slate-500">
                Используется базовая цена для всех дат
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {seasonalPrices.map((price) => {
                const colors = getSeasonColor(price.seasonType)
                
                return (
                  <div
                    key={price.id}
                    className={`p-4 border-2 ${colors.border} ${colors.bg} rounded-lg`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-slate-900">{price.label}</h4>
                          <Badge className={`${colors.bg} ${colors.text} border-0`}>
                            {colors.label}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-2">
                          📅 {format(new Date(price.startDate), 'dd MMMM yyyy', { locale: ru })} — {format(new Date(price.endDate), 'dd MMMM yyyy', { locale: ru })}
                        </p>
                        
                        <div className="flex gap-4 text-sm">
                          <span className="font-medium text-slate-900">
                            💰 {price.priceDaily?.toLocaleString('ru-RU')} ₿/день
                          </span>
                          {price.priceMonthly && (
                            <span className="font-medium text-teal-700">
                              📦 {price.priceMonthly?.toLocaleString('ru-RU')} ₿/месяц
                            </span>
                          )}
                        </div>
                        
                        {price.description && (
                          <p className="text-xs text-slate-500 mt-2">{price.description}</p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(price)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(price.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? 'Редактировать сезон' : 'Добавить сезонную цену'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <Label className="font-semibold">Выберите диапазон дат *</Label>
              <div className="border rounded-lg p-4 bg-slate-50">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={ru}
                  className="mx-auto"
                  classNames={{
                    months: "flex flex-col sm:flex-row gap-4",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex",
                    head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2",
                    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-teal-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-teal-50 rounded-md",
                    day_selected: "bg-teal-600 text-white hover:bg-teal-700 hover:text-white focus:bg-teal-600 focus:text-white",
                    day_today: "bg-slate-100 text-slate-900",
                    day_outside: "text-slate-400 opacity-50",
                    day_disabled: "text-slate-400 opacity-50",
                    day_hidden: "invisible",
                  }}
                />
              </div>
              {dateRange.from && dateRange.to && (
                <p className="text-sm text-slate-600 mt-2">
                  Выбрано: <strong>{format(dateRange.from, 'dd MMM yyyy', { locale: ru })} — {format(dateRange.to, 'dd MMM yyyy', { locale: ru })}</strong>
                </p>
              )}
            </div>

            {/* Season Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="label">Название сезона *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Высокий сезон"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="seasonType">Тип сезона *</Label>
                <Select 
                  value={formData.seasonType} 
                  onValueChange={(v) => setFormData({ ...formData, seasonType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-${type.color}-500`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceDaily">Цена за день (THB) *</Label>
                <Input
                  id="priceDaily"
                  type="number"
                  value={formData.priceDaily}
                  onChange={(e) => setFormData({ ...formData, priceDaily: e.target.value })}
                  placeholder={basePriceThb?.toString() || '10000'}
                />
                <p className="text-xs text-slate-500">
                  Базовая: {basePriceThb?.toLocaleString('ru-RU')} ₿
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priceMonthly">Цена за месяц (THB)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  placeholder="Опционально"
                />
                <p className="text-xs text-slate-500">
                  Для аренды 30+ дней
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание (опционально)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Например: Рождество и Новый Год — пик туристического сезона"
                rows={2}
              />
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">Важно:</p>
                <p>Диапазоны дат не должны пересекаться. Если период не покрыт сезонной ценой, будет использоваться базовая цена.</p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                editingPrice ? 'Обновить' : 'Создать'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
