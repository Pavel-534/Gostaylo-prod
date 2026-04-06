'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'
import { toast } from 'sonner'
import { getSeasonColor } from '@/lib/price-calculator'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import 'react-day-picker/dist/style.css'

const SEASON_TYPE_KEYS = [
  { value: 'LOW', labelKey: 'seasonLow', color: 'green' },
  { value: 'NORMAL', labelKey: 'seasonNormal', color: 'slate' },
  { value: 'HIGH', labelKey: 'seasonHigh', color: 'orange' },
  { value: 'PEAK', labelKey: 'seasonPeak', color: 'red' },
]

const SEASON_DOT_CLASS = {
  green: 'bg-green-500',
  slate: 'bg-slate-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

function seasonUiLabel(seasonType, t) {
  const row = SEASON_TYPE_KEYS.find((x) => x.value === seasonType)
  return t(row?.labelKey || 'seasonNormal')
}

export default function SeasonalPriceManager({ listingId, basePriceThb }) {
  const { language } = useI18n()
  const t = useCallback((key) => getUIText(key, language), [language])

  const dayPickerLocale = { ru, en: enUS, zh: zhCN, th: thDateLocale }[language] || ru

  const SEASON_TYPES = useMemo(
    () =>
      SEASON_TYPE_KEYS.map((row) => ({
        value: row.value,
        label: getUIText(row.labelKey, language),
        color: row.color,
      })),
    [language],
  )

  const numberLocale = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[language] || 'ru-RU'
  const baseNum =
    basePriceThb != null && basePriceThb !== ''
      ? Number(String(basePriceThb).replace(/\s/g, '').replace(',', '.'))
      : NaN
  const baseFormatted = Number.isFinite(baseNum) ? baseNum.toLocaleString(numberLocale) : '—'
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
      priceDaily: sanitizeThbDigits(String(price.priceDaily ?? '')),
      priceMonthly: price.priceMonthly != null ? sanitizeThbDigits(String(price.priceMonthly)) : '',
      description: price.description || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!dateRange.from || !dateRange.to) {
      toast.error(t('seasonalMgr_pickRangeErr'))
      return
    }

    if (!formData.label.trim()) {
      toast.error(t('seasonalMgr_nameRequired'))
      return
    }

    const dailyStr = sanitizeThbDigits(formData.priceDaily).replace(/\s/g, '')
    const dailyNum = dailyStr ? parseFloat(dailyStr) : NaN
    if (!dailyStr || !Number.isFinite(dailyNum) || dailyNum <= 0) {
      toast.error(t('seasonalMgr_priceRequired'))
      return
    }

    const monthlyStr = sanitizeThbDigits(formData.priceMonthly).replace(/\s/g, '')
    const monthlyNum = monthlyStr ? parseFloat(monthlyStr) : null

    setSaving(true)

    try {
      const payload = {
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        label: formData.label,
        seasonType: formData.seasonType,
        priceDaily: dailyNum,
        priceMonthly: monthlyNum != null && Number.isFinite(monthlyNum) ? monthlyNum : null,
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
        toast.success(editingPrice ? t('seasonalMgr_updated') : t('seasonalMgr_created'))
        setModalOpen(false)
        loadSeasonalPrices()
      } else {
        toast.error(data.error || t('seasonalMgr_saveErr'))
      }
    } catch (error) {
      console.error('Failed to save seasonal price:', error)
      toast.error(t('seasonalMgr_saveErr'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(priceId) {
    if (!confirm(t('seasonalMgr_confirmDelete'))) return

    try {
      const res = await fetch(`/api/v2/partner/seasonal-prices?id=${priceId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await res.json()

      if (data.status === 'success' || data.success) {
        toast.success(t('seasonalMgr_deleted'))
        loadSeasonalPrices()
      } else {
        toast.error(data.error || t('seasonalMgr_deleteErr'))
      }
    } catch (error) {
      console.error('Failed to delete seasonal price:', error)
      toast.error(t('seasonalMgr_deleteErr'))
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="h-5 w-5 shrink-0 text-teal-600" />
                {t('seasonalPricing')}
              </CardTitle>
              <CardDescription className="mt-2 space-y-1">
                <span className="block">{t('seasonalMgr_cardIntro')}</span>
                <span className="block text-slate-700">
                  <strong>{t('seasonalMgr_baseHint')}</strong>{' '}
                  <strong>
                    {baseFormatted} {t('seasonalMgr_perDay')}
                  </strong>
                </span>
              </CardDescription>
            </div>
            <Button
              onClick={openCreateModal}
              className="w-full shrink-0 bg-teal-600 hover:bg-teal-700 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('seasonalMgr_addSeasonBtn')}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {seasonalPrices.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-2">{t('seasonalMgr_emptyTitle')}</p>
              <p className="text-sm text-slate-500">{t('seasonalMgr_emptyDesc')}</p>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{price.label}</h4>
                          <Badge className={`max-sm:hidden ${colors.bg} ${colors.text} border-0`}>
                            {seasonUiLabel(price.seasonType, t)}
                          </Badge>
                        </div>

                        <p className="mb-2 text-sm text-slate-600">
                          📅 {format(new Date(price.startDate), 'dd MMMM yyyy', { locale: dayPickerLocale })} —{' '}
                          {format(new Date(price.endDate), 'dd MMMM yyyy', { locale: dayPickerLocale })}
                        </p>

                        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
                          <span className="font-medium text-slate-900">
                            💰 {price.priceDaily?.toLocaleString(numberLocale)} {t('seasonalMgr_perDay')}
                          </span>
                          {price.priceMonthly && (
                            <span className="font-medium text-teal-700">
                              📦 {price.priceMonthly?.toLocaleString(numberLocale)} {t('seasonalMgr_perMonth')}
                            </span>
                          )}
                        </div>

                        {price.description && (
                          <p className="mt-2 text-xs text-slate-500">{price.description}</p>
                        )}
                      </div>

                      <div className="flex max-sm:mx-1 max-sm:w-full max-sm:justify-between max-sm:gap-6 max-sm:px-1 shrink-0 gap-2 self-stretch sm:self-start sm:gap-2 sm:px-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-[52px] flex-1 px-4 sm:flex-none sm:min-h-9 sm:min-w-9 sm:px-3"
                          onClick={() => openEditModal(price)}
                          aria-label={t('seasonalMgr_editAria')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-[52px] flex-1 px-4 text-red-600 hover:bg-red-50 sm:flex-none sm:min-h-9 sm:min-w-9 sm:px-3"
                          onClick={() => handleDelete(price.id)}
                          aria-label={t('seasonalMgr_deleteAria')}
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex h-[min(92dvh,calc(100vh-1rem))] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[min(90dvh,720px)] sm:w-full">
          <div className="shrink-0 border-b px-4 pb-3 pt-12 sm:px-6 sm:pt-14">
            <DialogHeader className="text-left">
              <DialogTitle>{editingPrice ? t('seasonalMgr_titleEdit') : t('seasonalMgr_titleAdd')}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="font-semibold">{t('seasonalMgr_selectRange')}</Label>
              <div className="min-w-0 overflow-hidden rounded-lg border bg-slate-50 p-2 sm:p-4">
                <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
                  <div className="inline-flex min-w-full justify-center px-0.5 pb-1">
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={dayPickerLocale}
                      className="!p-0"
                      classNames={{
                        months: 'flex flex-col gap-4 sm:flex-row',
                        month: 'space-y-4',
                        caption: 'relative flex items-center justify-center pt-1',
                        caption_label: 'text-sm font-medium',
                        nav: 'flex items-center space-x-1',
                        nav_button:
                          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                        table: 'w-full border-collapse space-y-1',
                        head_row: 'flex',
                        head_cell:
                          'w-8 rounded-md text-[0.65rem] font-normal text-slate-500 sm:w-9 sm:text-[0.8rem]',
                        row: 'mt-2 flex w-full',
                        cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-teal-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
                        day: 'h-8 w-8 rounded-md p-0 font-normal hover:bg-teal-50 aria-selected:opacity-100 sm:h-9 sm:w-9',
                        day_selected:
                          'bg-teal-600 text-white hover:bg-teal-700 hover:text-white focus:bg-teal-600 focus:text-white',
                        day_today: 'bg-slate-100 text-slate-900',
                        day_outside: 'text-slate-400 opacity-50',
                        day_disabled: 'text-slate-400 opacity-50',
                        day_hidden: 'invisible',
                      }}
                    />
                  </div>
                </div>
              </div>
              {dateRange.from && dateRange.to && (
                <p className="text-sm text-slate-600 mt-2">
                  {t('seasonalMgr_rangeSelected')}{' '}
                  <strong>
                    {format(dateRange.from, 'dd MMM yyyy', { locale: dayPickerLocale })} —{' '}
                    {format(dateRange.to, 'dd MMM yyyy', { locale: dayPickerLocale })}
                  </strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="label">{t('seasonalMgr_seasonName')}</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={t('seasonalMgr_seasonNamePh')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seasonType">{t('seasonalMgr_seasonType')}</Label>
                <Select
                  value={formData.seasonType}
                  onValueChange={(v) => setFormData({ ...formData, seasonType: v })}
                >
                  <SelectTrigger id="seasonType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 shrink-0 rounded-full ${SEASON_DOT_CLASS[type.color] || 'bg-slate-400'}`}
                          />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceDaily">{t('seasonalMgr_priceDailyThb')}</Label>
                <Input
                  id="priceDaily"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.priceDaily}
                  onChange={(e) =>
                    setFormData({ ...formData, priceDaily: sanitizeThbDigits(e.target.value) })
                  }
                  placeholder={Number.isFinite(baseNum) ? String(Math.round(baseNum)) : '10000'}
                />
                <p className="text-xs text-slate-500">
                  {t('seasonalMgr_baseHint')} {baseFormatted} THB
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priceMonthly">{t('seasonalMgr_priceMonthlyThb')}</Label>
                <Input
                  id="priceMonthly"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.priceMonthly}
                  onChange={(e) =>
                    setFormData({ ...formData, priceMonthly: sanitizeThbDigits(e.target.value) })
                  }
                  placeholder={t('seasonalMgr_descriptionPh')}
                />
                <p className="text-xs text-slate-500">{t('seasonalMgr_priceMonthlyHint')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('seasonalMgr_descLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('seasonalMgr_descPlaceholder')}
                rows={2}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">{t('seasonalMgr_importantTitle')}</p>
                <p>{t('seasonalMgr_importantBody')}</p>
              </div>
            </div>
          </div>
          </div>

          <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="w-full sm:w-auto">
                {t('seasonalMgr_cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('seasonalMgr_saving')}
                  </>
                ) : editingPrice ? (
                  t('seasonalMgr_update')
                ) : (
                  t('seasonalMgr_create')
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
