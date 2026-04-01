'use client'

/**
 * Модалка «Все фильтры» — секции зависят от категории; цена + гистограмма по выборке.
 */

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { getSearchFilterPanelKind } from '@/lib/search/search-filter-panel-kind'
import { AMENITY_SLUGS } from '@/lib/listing-wizard-amenities'
import { amenityTranslations } from '@/lib/translations/categories'
import {
  LISTINGS_PRICE_SLIDER_MAX_THB,
  defaultExtraFilters,
} from '@/lib/search/listings-page-url'
import { NANNY_LANG_OPTIONS as NANNY_LANGS } from '@/lib/search/nanny-search-langs'
import { cn } from '@/lib/utils'

/** Выше Dialog overlay/content (z-[120]), иначе выпадающие списки не видны и кажутся «мёртвыми». */
const FILTER_DIALOG_SELECT_Z = 'z-[130]'

function amenityLabel(slug, language) {
  const row = amenityTranslations[slug] || amenityTranslations[String(slug).toLowerCase()]
  if (!row) return slug
  return language === 'ru' ? row.ru : row.en
}

function PriceHistogram({ listings, binCount = 14 }) {
  const { counts, max } = useMemo(() => {
    const maxP = LISTINGS_PRICE_SLIDER_MAX_THB
    const counts = Array(binCount).fill(0)
    for (const l of listings || []) {
      const p = parseFloat(l.basePriceThb ?? l.base_price_thb ?? 0) || 0
      if (p <= 0 || p > maxP) continue
      const i = Math.min(binCount - 1, Math.floor((p / maxP) * binCount))
      counts[i]++
    }
    const peak = Math.max(1, ...counts)
    return { counts, max: peak }
  }, [listings, binCount])

  return (
    <div className="flex h-14 items-end gap-px rounded-md border border-slate-100 bg-slate-50 px-1 py-1">
      {counts.map((c, i) => (
        <div
          key={i}
          className="min-w-0 flex-1 rounded-sm bg-teal-400/70 transition-[height]"
          style={{ height: `${Math.max(8, (c / max) * 100)}%` }}
          title={String(c)}
        />
      ))}
    </div>
  )
}

const ROOM_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8']

export function SearchFiltersDialog({
  open,
  onOpenChange,
  language = 'ru',
  categorySlug = 'all',
  extraFilters,
  onExtraFiltersChange,
  listingsSample = [],
  resultCount = 0,
}) {
  const panel = getSearchFilterPanelKind(categorySlug)
  const t = (ru, en) => (language === 'ru' ? ru : en)

  const slideMin = extraFilters.minPriceThb ?? 0
  const slideMax = extraFilters.maxPriceThb ?? LISTINGS_PRICE_SLIDER_MAX_THB

  const setPriceRange = ([lo, hi]) => {
    onExtraFiltersChange((prev) => ({
      ...prev,
      minPriceThb: lo <= 0 ? null : lo,
      maxPriceThb: hi >= LISTINGS_PRICE_SLIDER_MAX_THB ? null : hi,
    }))
  }

  const toggleAmenity = (slug) => {
    onExtraFiltersChange((prev) => {
      const set = new Set(prev.amenities || [])
      if (set.has(slug)) set.delete(slug)
      else set.add(slug)
      return { ...prev, amenities: [...set] }
    })
  }

  const toggleNannyLang = (id) => {
    onExtraFiltersChange((prev) => {
      const set = new Set(prev.nannyLangs || [])
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...prev, nannyLangs: [...set] }
    })
  }

  const clearAll = () => {
    onExtraFiltersChange(() => defaultExtraFilters())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Все фильтры', 'All filters')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-2">
          {/* Price — все категории */}
          <section className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">
              {t('Цена за ночь (฿)', 'Price per night (฿)')}
            </Label>
            <p className="text-xs text-slate-500">
              {t(
                'Гистограмма по текущей выборке на странице',
                'Histogram reflects the current result set on this page'
              )}
            </p>
            <PriceHistogram listings={listingsSample} />
            <Slider
              min={0}
              max={LISTINGS_PRICE_SLIDER_MAX_THB}
              step={500}
              value={[slideMin, slideMax]}
              onValueChange={setPriceRange}
              className="pt-2"
            />
            <div className="flex justify-between text-sm text-slate-600">
              <span>
                {slideMin <= 0 ? t('Любая', 'Any') : `฿${slideMin.toLocaleString()}`}
              </span>
              <span>
                {slideMax >= LISTINGS_PRICE_SLIDER_MAX_THB
                  ? t('Любая', 'Any')
                  : `฿${slideMax.toLocaleString()}`}
              </span>
            </div>
          </section>

          {panel === 'housing' && (
            <section className="space-y-4">
              <Label className="text-base font-semibold text-slate-900">
                {t('Жильё', 'Property')}
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">{t('Спален (мин.)', 'Bedrooms (min)')}</Label>
                  <Select
                    value={String(extraFilters.bedroomsMin ?? 0)}
                    onValueChange={(v) =>
                      onExtraFiltersChange((p) => ({
                        ...p,
                        bedroomsMin: v === '0' ? null : parseInt(v, 10),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={FILTER_DIALOG_SELECT_Z}>
                      {ROOM_OPTIONS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n === '0' ? t('Любое', 'Any') : n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">
                    {t('Ванных (мин.)', 'Bathrooms (min)')}
                  </Label>
                  <Select
                    value={String(extraFilters.bathroomsMin ?? 0)}
                    onValueChange={(v) =>
                      onExtraFiltersChange((p) => ({
                        ...p,
                        bathroomsMin: v === '0' ? null : parseInt(v, 10),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={FILTER_DIALOG_SELECT_Z}>
                      {ROOM_OPTIONS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n === '0' ? t('Любое', 'Any') : n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-800">{t('Удобства', 'Amenities')}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMENITY_SLUGS.map((slug) => {
                    const checked = extraFilters.amenities?.includes(slug)
                    return (
                      <label
                        key={slug}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm',
                          checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleAmenity(slug)}
                        />
                        <span className="truncate">{amenityLabel(slug, language)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {panel === 'transport' && (
            <section className="space-y-4">
              <Label className="text-base font-semibold text-slate-900">
                {t('Транспорт', 'Vehicle')}
              </Label>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">{t('Коробка передач', 'Transmission')}</Label>
                <Select
                  value={extraFilters.transmission || 'any'}
                  onValueChange={(v) =>
                    onExtraFiltersChange((p) => ({
                      ...p,
                      transmission: v === 'any' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={FILTER_DIALOG_SELECT_Z}>
                    <SelectItem value="any">{t('Любая', 'Any')}</SelectItem>
                    <SelectItem value="automatic">{t('Автомат', 'Automatic')}</SelectItem>
                    <SelectItem value="manual">{t('Механика', 'Manual')}</SelectItem>
                    <SelectItem value="cvt">CVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">{t('Топливо', 'Fuel type')}</Label>
                <Select
                  value={extraFilters.fuelType || 'any'}
                  onValueChange={(v) =>
                    onExtraFiltersChange((p) => ({
                      ...p,
                      fuelType: v === 'any' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={FILTER_DIALOG_SELECT_Z}>
                    <SelectItem value="any">{t('Любое', 'Any')}</SelectItem>
                    <SelectItem value="petrol">{t('Бензин', 'Petrol')}</SelectItem>
                    <SelectItem value="diesel">{t('Дизель', 'Diesel')}</SelectItem>
                    <SelectItem value="electric">{t('Электро', 'Electric')}</SelectItem>
                    <SelectItem value="hybrid">{t('Гибрид', 'Hybrid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">
                  {t('Объём двигателя от, см³', 'Engine displacement from (cc)')}
                </Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0}
                    max={5000}
                    step={50}
                    value={[extraFilters.engineCcMin ?? 0]}
                    onValueChange={([v]) =>
                      onExtraFiltersChange((p) => ({
                        ...p,
                        engineCcMin: v <= 0 ? null : v,
                      }))
                    }
                    className="flex-1"
                  />
                  <span className="w-16 text-right text-sm text-slate-600">
                    {(extraFilters.engineCcMin ?? 0) <= 0 ? '—' : `${extraFilters.engineCcMin}`}
                  </span>
                </div>
              </div>
            </section>
          )}

          {panel === 'nanny' && (
            <section className="space-y-4">
              <Label className="text-base font-semibold text-slate-900">
                {t('Няня / услуги', 'Nanny / services')}
              </Label>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">{t('Языки', 'Languages')}</Label>
                <div className="flex flex-wrap gap-2">
                  {NANNY_LANGS.map((row) => {
                    const checked = extraFilters.nannyLangs?.includes(row.id)
                    return (
                      <label
                        key={row.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                          checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleNannyLang(row.id)}
                        />
                        {row[language] || row.en}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">
                  {t('Опыт от, лет', 'Experience from (years)')}
                </Label>
                <Select
                  value={String(extraFilters.nannyExperienceMin ?? 0)}
                  onValueChange={(v) =>
                    onExtraFiltersChange((p) => ({
                      ...p,
                      nannyExperienceMin: v === '0' ? null : parseInt(v, 10),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={FILTER_DIALOG_SELECT_Z}>
                    {['0', '1', '2', '3', '5', '10'].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n === '0' ? t('Любой', 'Any') : `${n}+`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">
                  {t('Специализация (ключевое слово)', 'Specialization (keyword)')}
                </Label>
                <Input
                  value={extraFilters.nannySpecialization || ''}
                  onChange={(e) =>
                    onExtraFiltersChange((p) => ({
                      ...p,
                      nannySpecialization: e.target.value,
                    }))
                  }
                  placeholder={t('Например: младенцы', 'e.g. infants')}
                />
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="text-slate-600" onClick={clearAll}>
            {t('Сбросить всё', 'Clear all')}
          </Button>
          <Button
            type="button"
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => onOpenChange(false)}
          >
            {t('Показать', 'Show')}{' '}
            {resultCount}{' '}
            {t('вариантов', 'results')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
