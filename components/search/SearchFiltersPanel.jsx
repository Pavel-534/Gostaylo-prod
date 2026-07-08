'use client'

/**
 * SearchFiltersPanel — controlled filter body (ADR-102).
 * Shell-agnostic: Dialog (Phase 1) or Drawer (Phase 2).
 */

import { useMemo } from 'react'
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
import { PROPERTY_PARTNER_AMENITY_SLUGS } from '@/lib/listing-wizard-amenities'
import { AmenityLucideIcon } from '@/lib/listing/amenity-lucide-icon'
import { amenityTranslations } from '@/lib/translations/categories'
import { LISTINGS_PRICE_SLIDER_MAX_THB } from '@/lib/search/listings-page-url'
import { getEffectiveSearchUnitPriceThb } from '@/lib/search/effective-unit-price-for-search'
import { NANNY_LANG_OPTIONS as NANNY_LANGS } from '@/lib/search/nanny-search-langs'
import { cn } from '@/lib/utils'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'
import { isYachtLikeCategory } from '@/lib/listing-category-slug'
import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'

/** Above Dialog overlay/content (z-[120]) so Select portals are interactive. */
export const SEARCH_FILTERS_SELECT_Z = 'z-[130]'

const ROOM_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8']

function amenityLabel(slug, language) {
  const row = amenityTranslations[slug] || amenityTranslations[String(slug).toLowerCase()]
  if (!row) return slug
  return language === 'ru' ? row.ru : row.en
}

function PriceHistogram({ listings, binCount = 14, histogramBins = null, maxThb = LISTINGS_PRICE_SLIDER_MAX_THB }) {
  const { counts, max } = useMemo(() => {
    if (Array.isArray(histogramBins) && histogramBins.length > 0) {
      const counts = histogramBins
      const peak = Math.max(1, ...counts)
      return { counts, max: peak }
    }
    const maxP = maxThb
    const counts = Array(binCount).fill(0)
    for (const l of listings || []) {
      const p = getEffectiveSearchUnitPriceThb(l)
      if (p <= 0 || p > maxP) continue
      const i = Math.min(binCount - 1, Math.floor((p / maxP) * binCount))
      counts[i]++
    }
    const peak = Math.max(1, ...counts)
    return { counts, max: peak }
  }, [listings, binCount, histogramBins, maxThb])

  return (
    <div className="flex h-14 items-end gap-px rounded-md border border-slate-100 bg-slate-50 px-1 py-1">
      {counts.map((c, i) => (
        <div
          key={i}
          className="min-w-0 flex-1 rounded-sm bg-brand/40 transition-[height]"
          style={{ height: `${Math.max(8, (c / max) * 100)}%` }}
          title={String(c)}
        />
      ))}
    </div>
  )
}

/**
 * @param {{
 *   values: import('@/lib/search/listings-page-url.js').ListingsExtraFilters,
 *   onChange: (updater: import('@/lib/search/listings-page-url.js').ListingsExtraFilters | ((prev: import('@/lib/search/listings-page-url.js').ListingsExtraFilters) => import('@/lib/search/listings-page-url.js').ListingsExtraFilters)) => void,
 *   language?: string,
 *   categorySlug?: string,
 *   categoryWizardProfile?: string | null,
 *   listingsSample?: object[],
 *   priceHistogram?: { bins?: number[], binCount?: number, maxThb?: number } | null,
 *   selectPortalClassName?: string,
 * }} props
 */
export function SearchFiltersPanel({
  values,
  onChange,
  language = 'ru',
  categorySlug = 'all',
  categoryWizardProfile = null,
  listingsSample = [],
  priceHistogram = null,
  selectPortalClassName = SEARCH_FILTERS_SELECT_Z,
}) {
  const panel = getSearchFilterPanelKind(categorySlug, categoryWizardProfile)
  const t = (ru, en) => (language === 'ru' ? ru : en)

  const pricePeriodLabel =
    getListingRentalPeriodMode(categorySlug) === 'day'
      ? t('Цена за сутки (฿)', 'Price per day (฿)')
      : t('Цена за ночь (฿)', 'Price per night (฿)')

  const showYachtCabinsFilter =
    isYachtLikeCategory(categorySlug) ||
    normalizeCategoryWizardProfileColumn(categoryWizardProfile) === 'yacht'

  const slideMin = values.minPriceThb ?? 0
  const slideMax = values.maxPriceThb ?? LISTINGS_PRICE_SLIDER_MAX_THB

  const setPriceRange = ([lo, hi]) => {
    onChange((prev) => ({
      ...prev,
      minPriceThb: lo <= 0 ? null : lo,
      maxPriceThb: hi >= LISTINGS_PRICE_SLIDER_MAX_THB ? null : hi,
    }))
  }

  const toggleAmenity = (slug) => {
    onChange((prev) => {
      const set = new Set(prev.amenities || [])
      if (set.has(slug)) set.delete(slug)
      else set.add(slug)
      return { ...prev, amenities: [...set] }
    })
  }

  const toggleNannyLang = (id) => {
    onChange((prev) => {
      const set = new Set(prev.nannyLangs || [])
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...prev, nannyLangs: [...set] }
    })
  }

  return (
    <div className="space-y-8 py-2">
      <section className="space-y-3">
        <Label className="text-base font-semibold text-slate-900">{pricePeriodLabel}</Label>
        <p className="text-xs text-slate-500">
          {priceHistogram?.bins?.length
            ? t(
                'Гистограмма по результатам поиска на сервере',
                'Histogram from server search results',
              )
            : t(
                'Гистограмма по текущей выборке на странице',
                'Histogram reflects the current result set on this page',
              )}
        </p>
        <PriceHistogram
          listings={listingsSample}
          binCount={priceHistogram?.binCount ?? 14}
          histogramBins={priceHistogram?.bins ?? null}
          maxThb={priceHistogram?.maxThb ?? LISTINGS_PRICE_SLIDER_MAX_THB}
        />
        <Slider
          min={0}
          max={LISTINGS_PRICE_SLIDER_MAX_THB}
          step={500}
          value={[slideMin, slideMax]}
          onValueChange={setPriceRange}
          className="pt-2"
        />
        <div className="flex justify-between text-sm text-slate-600">
          <span>{slideMin <= 0 ? t('Любая', 'Any') : `฿${slideMin.toLocaleString()}`}</span>
          <span>
            {slideMax >= LISTINGS_PRICE_SLIDER_MAX_THB
              ? t('Любая', 'Any')
              : `฿${slideMax.toLocaleString()}`}
          </span>
        </div>
      </section>

      {panel === 'housing' && (
        <section className="space-y-4">
          <Label className="text-base font-semibold text-slate-900">{t('Жильё', 'Property')}</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">{t('Спален (мин.)', 'Bedrooms (min)')}</Label>
              <Select
                value={String(values.bedroomsMin ?? 0)}
                onValueChange={(v) =>
                  onChange((p) => ({
                    ...p,
                    bedroomsMin: v === '0' ? null : parseInt(v, 10),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectPortalClassName}>
                  {ROOM_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n === '0' ? t('Любое', 'Any') : n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">{t('Ванных (мин.)', 'Bathrooms (min)')}</Label>
              <Select
                value={String(values.bathroomsMin ?? 0)}
                onValueChange={(v) =>
                  onChange((p) => ({
                    ...p,
                    bathroomsMin: v === '0' ? null : parseInt(v, 10),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectPortalClassName}>
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
              {PROPERTY_PARTNER_AMENITY_SLUGS.map((slug) => {
                const checked = values.amenities?.includes(slug)
                return (
                  <label
                    key={slug}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm',
                      checked ? 'border-brand bg-brand/10' : 'border-slate-200',
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleAmenity(slug)} />
                    <AmenityLucideIcon slug={slug} className="h-4 w-4 shrink-0 text-brand" />
                    <span className="truncate">{amenityLabel(slug, language)}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={values.instantBookingOnly === true}
                onCheckedChange={(checked) =>
                  onChange((p) => ({
                    ...p,
                    instantBookingOnly: checked === true,
                  }))
                }
              />
              <span>{t('Только мгновенное бронирование', 'Instant booking only')}</span>
            </label>
          </div>
        </section>
      )}

      {panel === 'transport' && (
        <section className="space-y-4">
          <Label className="text-base font-semibold text-slate-900">{t('Транспорт', 'Vehicle')}</Label>
          <div className="space-y-2">
            <Label className="text-xs text-slate-600">{t('Коробка передач', 'Transmission')}</Label>
            <Select
              value={values.transmission || 'any'}
              onValueChange={(v) =>
                onChange((p) => ({
                  ...p,
                  transmission: v === 'any' ? '' : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectPortalClassName}>
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
              value={values.fuelType || 'any'}
              onValueChange={(v) =>
                onChange((p) => ({
                  ...p,
                  fuelType: v === 'any' ? '' : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectPortalClassName}>
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
                value={[values.engineCcMin ?? 0]}
                onValueChange={([v]) =>
                  onChange((p) => ({
                    ...p,
                    engineCcMin: v <= 0 ? null : v,
                  }))
                }
                className="flex-1"
              />
              <span className="w-16 text-right text-sm text-slate-600">
                {(values.engineCcMin ?? 0) <= 0 ? '—' : `${values.engineCcMin}`}
              </span>
            </div>
          </div>
          {showYachtCabinsFilter && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">{t('Кают (мин.)', 'Cabins (min.)')}</Label>
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={16}
                  step={1}
                  value={[values.cabinsMin ?? 0]}
                  onValueChange={([v]) =>
                    onChange((p) => ({
                      ...p,
                      cabinsMin: v <= 0 ? null : v,
                    }))
                  }
                  className="flex-1"
                />
                <span className="w-16 text-right text-sm text-slate-600">
                  {(values.cabinsMin ?? 0) <= 0 ? '—' : `${values.cabinsMin}`}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {panel === 'service' && (
        <section className="space-y-4">
          <Label className="text-base font-semibold text-slate-900">
            {t('Услуги (няни, повара, массаж)', 'Services (nannies, chefs, massage)')}
          </Label>
          <div className="space-y-2">
            <Label className="text-xs text-slate-600">
              {t('Языки (все выбранные)', 'Languages (match all)')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {NANNY_LANGS.map((row) => {
                const checked = values.nannyLangs?.includes(row.id)
                const label = row[language] || row.en
                return (
                  <label
                    key={row.id}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-sm',
                      checked ? 'border-brand bg-brand/10' : 'border-slate-200',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleNannyLang(row.id)}
                      className="h-5 w-5 shrink-0"
                      aria-label={label}
                    />
                    <span className="leading-none">{label}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700">
              <Checkbox
                checked={values.serviceHomeVisitOnly === true}
                onCheckedChange={(checked) =>
                  onChange((p) => ({
                    ...p,
                    serviceHomeVisitOnly: checked === true,
                  }))
                }
                className="h-5 w-5 shrink-0"
              />
              <span>{t('Выезд на дом', 'Home visit')}</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-600">
              {t('Опыт работы от, лет', 'Work experience from (years)')}
            </Label>
            <Select
              value={String(values.nannyExperienceMin ?? 0)}
              onValueChange={(v) =>
                onChange((p) => ({
                  ...p,
                  nannyExperienceMin: v === '0' ? null : parseInt(v, 10),
                }))
              }
            >
              <SelectTrigger className="min-h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectPortalClassName}>
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
              value={values.nannySpecialization || ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  nannySpecialization: e.target.value,
                }))
              }
              placeholder={t('Например: младенцы', 'e.g. infants')}
              className="min-h-11 rounded-2xl text-base"
            />
          </div>
        </section>
      )}
    </div>
  )
}

export default SearchFiltersPanel
