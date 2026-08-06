'use client'

/**
 * Stage 200.36 / 200.43 / 200.45 / 200.46 — Location: typeahead + pin/country conflict UX.
 * Address search + map remain accelerators; geo merge via handleMapSelect / wizard-geo-from-pin.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, MapPin, AlertTriangle, Search } from 'lucide-react'
import { useListingWizard } from '../context/ListingWizardContext'
import { LAUNCH_MARKETS } from '@/lib/geo/wizard-geo-from-pin'
import { COUNTRY_CURRENCY_TZ } from '@/lib/geo/launch-markets-seed-data'
import { resolveListingPlaceTimezone } from '@/lib/geo/listing-timezone-guess'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'
import { normalizeGeoPlaceName } from '@/lib/geo/normalize-geo-place-name'
import {
  clearWizardFormPin,
  detectPinCountryConflict,
} from '@/lib/geo/wizard-pin-country-conflict'
import { getIsoCountryLabel } from '@/lib/geo/iso-countries-catalog'
import { getCountryMapViewportCentroid } from '@/lib/geo/country-map-viewport'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
import { WizardCountryTypeahead } from './WizardCountryTypeahead'
import { WizardCityTypeahead } from './WizardCityTypeahead'
import { cn } from '@/lib/utils'
import { wizardFieldErrorClass, wizardFieldHasError } from '../lib/wizard-field-errors'
import { getCurrencySymbol } from '@/lib/currency'

const MapPicker = dynamic(() => import('@/components/listing/MapPicker'), { ssr: false })

async function fetchGeoNodes({ level, parent, lang }) {
  const params = new URLSearchParams()
  if (level) params.set('level', level)
  if (parent) params.set('parent', parent)
  if (lang) params.set('lang', lang)
  const res = await fetch(`/api/v2/geo/locations?${params}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) return []
  return Array.isArray(json.data) ? json.data : []
}

function hasValidPin(formData) {
  const lat = Number(formData?.latitude)
  const lon = Number(formData?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lon)
}

function StepLocationInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
    setFormData,
    updateField,
    customDistricts,
    setCustomDistricts,
    transportWizard,
    listingCategorySlug,
    language,
    geocodeQuery,
    setGeocodeQuery,
    geocodeResults,
    setGeocodeResults,
    geocoding,
    setGeocoding,
    handleMapSelect,
    coordsValid,
    updateMetadata,
    stepFieldErrors,
    tr,
    baseCurrencyLocked,
  } = w

  const errDistrict = wizardFieldHasError(stepFieldErrors, 'district')
  const errCountry = wizardFieldHasError(stepFieldErrors, 'country')
  const errCoords = wizardFieldHasError(stepFieldErrors, 'coordinates')
  const errCity = wizardFieldHasError(stepFieldErrors, 'city')
  const errPinConflict = wizardFieldHasError(stepFieldErrors, 'pinCountryConflict')

  const [regions, setRegions] = useState([])
  const [geoUnavailable, setGeoUnavailable] = useState(false)
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)
  const [pinConflictBusy, setPinConflictBusy] = useState(false)
  const debounceRef = useRef(null)
  const [mapCenter, setMapCenter] = useState(null)

  const cityLabel = String(formData.metadata?.city_label || formData.metadata?.city || '')
  const cityUnmatched =
    formData.metadata?.geo_city_unmatched === true ||
    (!formData.city && Boolean(cityLabel.trim()))

  const launchOk = !formData.country || LAUNCH_MARKETS.has(String(formData.country).toUpperCase())

  const pinConflict = useMemo(
    () =>
      detectPinCountryConflict({
        country: formData.country,
        lat: formData.latitude,
        lon: formData.longitude,
        pinCountryCode: formData.metadata?.geo_pin_country,
        dismissed: formData.metadata?.geo_pin_country_conflict_dismissed === true,
      }),
    [
      formData.country,
      formData.latitude,
      formData.longitude,
      formData.metadata?.geo_pin_country,
      formData.metadata?.geo_pin_country_conflict_dismissed,
    ],
  )

  const countryDisplayLabel = useMemo(
    () => getIsoCountryLabel(formData.country, language) || formData.country || '',
    [formData.country, language],
  )

  const currencyInfo = useMemo(() => {
    const iso = String(formData.country || '').toUpperCase()
    const countryCur =
      COUNTRY_CURRENCY_TZ[iso]?.currency || getDefaultListingBaseCurrency(iso) || 'USD'
    const cur = baseCurrencyLocked
      ? String(formData.baseCurrency || countryCur).toUpperCase()
      : countryCur
    const tz =
      resolveListingPlaceTimezone({
        lat: formData.latitude,
        lon: formData.longitude,
        cityTimezone: null,
        countryCode: iso,
        explicitTimezone: formData.metadata?.timezone,
      }) || '—'
    return { cur, tz, symbol: getCurrencySymbol(cur) }
  }, [
    formData.country,
    formData.baseCurrency,
    formData.metadata?.timezone,
    formData.latitude,
    formData.longitude,
    baseCurrencyLocked,
  ])

  const districtOptions = useMemo(() => {
    const set = new Set(
      [...customDistricts, formData.district].filter((d) => String(d || '').trim()),
    )
    return Array.from(set)
  }, [customDistricts, formData.district])

  // Regions when country changes (optional hub cascade)
  useEffect(() => {
    const cc = formData.country
    if (!cc) {
      setRegions([])
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const rows = await fetchGeoNodes({ parent: cc, lang: language })
      if (!cancelled) {
        setRegions(rows.filter((r) => r.level === 'region' || !r.level))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formData.country, language])

  const runGeocodeSearch = useCallback(
    async (q) => {
      const query = String(q || '').trim()
      if (query.length < 3) {
        setGeocodeResults([])
        return
      }
      setGeocoding(true)
      try {
        const country = formData.country ? `&country=${encodeURIComponent(formData.country)}` : ''
        const res = await fetch(
          `/api/v2/geocode/suggest?q=${encodeURIComponent(query)}${country}`,
        )
        const data = await res.json()
        if (res.ok && data.success && data.data?.length) {
          setGeocodeResults(data.data)
          setGeoUnavailable(false)
        } else if (res.status === 502 || data?.code === 'NOMINATIM_UNAVAILABLE') {
          setGeoUnavailable(true)
          setGeocodeResults([])
        } else {
          setGeocodeResults([])
        }
      } catch {
        setGeoUnavailable(true)
        setGeocodeResults([])
      } finally {
        setGeocoding(false)
      }
    },
    [formData.country, setGeocodeResults, setGeocoding],
  )

  const onGeocodeQueryChange = (value) => {
    setGeocodeQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runGeocodeSearch(value), 300)
  }

  const selectGeocodeResult = async (r) => {
    setGeocodeResults([])
    setGeocodeQuery(r.displayName || r.labelRu || r.labelEn || '')
    handleMapSelect(r.lat, r.lon, {
      displayName: r.displayName,
      countryCode: r.address?.country_code || null,
      country: r.address?.country || null,
      city: r.address?.city || r.address?.town || r.address?.municipality || r.labelEn || null,
      state: r.address?.state || null,
      district: r.address?.suburb || r.address?.neighbourhood || null,
      address: r.address || null,
      regionCode: r.regionCode || null,
      cityCode: r.cityCode || null,
      cityTimezone: r.timezone || null,
      geoSource: r.source || 'suggest',
    })
    try {
      const rev = await fetch(
        `/api/v2/geocode/reverse?lat=${r.lat}&lon=${r.lon}`,
        { cache: 'no-store' },
      )
      const json = await rev.json()
      if (json.degraded) {
        setGeoUnavailable(true)
      }
      if (json.success && json.data) {
        handleMapSelect(r.lat, r.lon, {
          displayName: json.data.displayName || r.displayName,
          district: json.data.district,
          city: json.data.city,
          country: json.data.country,
          countryCode: json.data.countryCode,
          state: json.data.state,
          address: json.data.address,
          regionCode: json.data.regionCode || r.regionCode || null,
          cityCode: json.data.cityCode || r.cityCode || null,
          timezone: json.data.timezone,
          currencyCode: json.data.currencyCode,
          geoSource: json.data.geoSource,
        })
        if (json.data.district) {
          setCustomDistricts((prev) =>
            prev.includes(json.data.district) ? prev : [...prev, json.data.district],
          )
        }
      }
    } catch {
      setGeoUnavailable(true)
    }
  }

  const applyCountrySideEffects = (code, meta = {}) => {
    updateField('country', code)
    updateField('region', '')
    updateField('city', '')
    updateField('district', '')
    updateMetadata('city_label', '')
    updateMetadata('city', '')
    updateMetadata('geo_city_unmatched', false)
    updateMetadata('geo_pin_country_conflict_dismissed', false)
    const nextCurrency =
      COUNTRY_CURRENCY_TZ[code]?.currency || getDefaultListingBaseCurrency(code)
    if (!baseCurrencyLocked && nextCurrency) {
      updateField('baseCurrency', nextCurrency)
    }
    updateMetadata(
      'timezone',
      resolveListingPlaceTimezone({
        lat: formData.latitude,
        lon: formData.longitude,
        countryCode: code,
      }),
    )
    if (meta.centroidLat != null && meta.centroidLng != null) {
      setMapCenter([meta.centroidLat, meta.centroidLng])
    } else {
      const fallback = getCountryMapViewportCentroid(code)
      if (fallback) setMapCenter(fallback)
    }
  }

  const handleCountrySelect = async (code) => {
    // Optimistic: currency/TZ/cascade clear immediately (do not wait on ensure-country)
    applyCountrySideEffects(code)
    try {
      const res = await fetch('/api/v2/partner/geo/ensure-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ country_code: code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setGeoUnavailable(true)
      } else {
        setGeoUnavailable(false)
        if (json.data?.centroidLat != null && json.data?.centroidLng != null) {
          setMapCenter([json.data.centroidLat, json.data.centroidLng])
        }
      }
    } catch {
      setGeoUnavailable(true)
    }
  }

  const handleRegionChange = (code) => {
    updateField('region', code)
    updateField('city', '')
    updateField('district', '')
    updateMetadata('city_label', '')
    updateMetadata('geo_city_unmatched', false)
    const row = regions.find((r) => r.code === code)
    if (row?.timezone || row?.centroidLat != null) {
      updateMetadata(
        'timezone',
        resolveListingPlaceTimezone({
          lat: formData.latitude ?? row?.centroidLat,
          lon: formData.longitude ?? row?.centroidLng,
          regionTimezone: row?.timezone,
          countryCode: formData.country,
        }),
      )
    }
    if (row?.centroidLat != null && row?.centroidLng != null) {
      setMapCenter([row.centroidLat, row.centroidLng])
    }
  }

  const handleCitySuggestSelect = async (r) => {
    const label = normalizeGeoPlaceName(
      r._normalizedLabel || r.labelRu || r.labelEn || r.address?.city || r.displayName,
    )
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    const cityCode = r.cityCode || (r.level === 'city' || r.level === 'neighborhood' ? r.code : null)
    const regionCode = r.regionCode || null

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      setMapCenter([lat, lon])
    }

    if (!hasValidPin(formData) && Number.isFinite(lat) && Number.isFinite(lon)) {
      handleMapSelect(lat, lon, {
        displayName: r.displayName || label,
        countryCode: formData.country || r.address?.country_code,
        country: r.address?.country,
        city: label,
        state: r.address?.state,
        district: r.address?.suburb || r.address?.neighbourhood || null,
        address: r.address || null,
        regionCode,
        cityCode,
        cityTimezone: r.timezone || null,
        geoSource: r.source || 'city_suggest',
      })
      return
    }

    if (regionCode) updateField('region', regionCode)
    updateField('city', cityCode || '')
    updateMetadata('city_label', label)
    updateMetadata('city', label)
    updateMetadata('geo_city_unmatched', !cityCode)
    updateField('district', '')
    if (!hasValidPin(formData)) {
      updateMetadata(
        'timezone',
        resolveListingPlaceTimezone({
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          cityTimezone: r.timezone || null,
          countryCode: formData.country,
        }),
      )
    }
  }

  const handleCityManualSelect = (label) => {
    const normalized = normalizeGeoPlaceName(label)
    updateField('city', '')
    updateMetadata('city_label', normalized)
    updateMetadata('city', normalized)
    updateMetadata('geo_city_unmatched', true)
    updateField('district', '')
    if (!hasValidPin(formData)) {
      updateMetadata(
        'timezone',
        resolveListingPlaceTimezone({ countryCode: formData.country }),
      )
    }
  }

  const handleCityClear = () => {
    updateField('city', '')
    updateMetadata('city_label', '')
    updateMetadata('city', '')
    updateMetadata('geo_city_unmatched', false)
  }

  const handlePinConflictKeepCountry = () => {
    const tz = resolveListingPlaceTimezone({ countryCode: formData.country })
    setFormData((prev) => clearWizardFormPin(prev, { timezone: tz }))
  }

  const handlePinConflictUseMap = async () => {
    if (!hasValidPin(formData)) return
    setPinConflictBusy(true)
    try {
      const lat = Number(formData.latitude)
      const lon = Number(formData.longitude)
      const rev = await fetch(`/api/v2/geocode/reverse?lat=${lat}&lon=${lon}`, {
        cache: 'no-store',
      })
      const json = await rev.json().catch(() => ({}))
      if (json.success && json.data) {
        handleMapSelect(lat, lon, {
          displayName: json.data.displayName,
          district: json.data.district,
          city: json.data.city,
          country: json.data.country,
          countryCode: json.data.countryCode,
          state: json.data.state,
          address: json.data.address,
          regionCode: json.data.regionCode || null,
          cityCode: json.data.cityCode || null,
          timezone: json.data.timezone,
          currencyCode: json.data.currencyCode,
          geoSource: json.data.geoSource || 'pin_conflict_resolve',
        })
      } else {
        handleMapSelect(lat, lon, {
          countryCode: formData.metadata?.geo_pin_country || null,
          geoSource: 'pin_conflict_resolve',
        })
      }
      updateMetadata('geo_pin_country_conflict_dismissed', false)
    } catch {
      setGeoUnavailable(true)
    } finally {
      setPinConflictBusy(false)
    }
  }

  const handlePinConflictDismiss = () => {
    updateMetadata('geo_pin_country_conflict_dismissed', true)
  }

  return (
    <div className={WIZARD_STEP_ROOT_CLASS}>
      <div>
        <h2 className={`mb-2 ${WIZARD_STEP_TITLE_CLASS}`}>
          {transportWizard ? t('whereIsListingTransport') : t('whereIsListing')}
        </h2>
        <p className={WIZARD_STEP_SUBTITLE_CLASS}>
          {transportWizard ? t('helpGuestsFindTransport') : t('helpGuestsFind')}
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 min-w-0 overflow-x-hidden">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('wizardGeo_cascadeTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('wizardGeo_cascadeHint')}</p>
        </div>

        {!launchOk ? (
          <Alert
            className="border-amber-200 bg-amber-50 text-amber-950"
            data-testid="wizard-geo-non-launch-banner"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{t('wizardGeo_nonLaunchWarning')}</AlertDescription>
          </Alert>
        ) : null}

        {pinConflict.conflict &&
        formData.metadata?.geo_pin_country_conflict_dismissed !== true ? (
          <Alert
            className={cn(
              'min-w-0 overflow-hidden border-amber-200 bg-amber-50 text-amber-950',
              errPinConflict && 'border-red-400 ring-2 ring-inset ring-red-400',
            )}
            data-wizard-field="pinCountryConflict"
            data-wizard-field-error={errPinConflict ? 'true' : undefined}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('wizardGeo_pinConflictTitle')}</AlertTitle>
            <AlertDescription className="min-w-0 space-y-3 text-xs">
              <p className="break-words">
                {tr
                  ? tr('wizardGeo_pinConflictBody', { country: countryDisplayLabel })
                  : t('wizardGeo_pinConflictBody')}
              </p>
              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="button"
                  variant="brand"
                  className="h-auto min-h-[44px] w-full whitespace-normal px-3 py-2 text-center leading-snug"
                  disabled={pinConflictBusy}
                  onClick={handlePinConflictKeepCountry}
                >
                  {t('wizardGeo_pinConflictKeepCountry')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[44px] w-full whitespace-normal px-3 py-2 text-center leading-snug"
                  disabled={pinConflictBusy}
                  onClick={handlePinConflictUseMap}
                >
                  {pinConflictBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                  ) : null}
                  {t('wizardGeo_pinConflictUseMap')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-[44px] w-full whitespace-normal px-3 py-2 text-center leading-snug text-slate-600"
                  disabled={pinConflictBusy}
                  onClick={handlePinConflictDismiss}
                >
                  {t('wizardGeo_pinConflictDismiss')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {geoUnavailable ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('wizardGeo_serviceDownTitle')}</AlertTitle>
            <AlertDescription className="text-xs">{t('wizardGeo_serviceDownBody')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div data-wizard-field="country" data-wizard-field-error={errCountry ? 'true' : undefined}>
            <Label className={cn('text-sm font-medium', errCountry && 'text-red-700')}>
              {t('country') || 'Country'}
            </Label>
            <div className="mt-1.5">
              <WizardCountryTypeahead
                value={formData.country || ''}
                language={language}
                hasError={errCountry}
                placeholder={t('wizardGeo_countryTypeaheadPh')}
                onSelect={handleCountrySelect}
              />
            </div>
          </div>

          <div data-wizard-field="city" data-wizard-field-error={errCity ? 'true' : undefined}>
            <Label className={cn('text-sm font-medium', errCity && 'text-red-700')}>
              {t('city') || 'City'}
            </Label>
            <div className="mt-1.5">
              <WizardCityTypeahead
                countryCode={formData.country || ''}
                valueLabel={cityLabel}
                disabled={!formData.country}
                hasError={errCity}
                placeholder={
                  formData.country
                    ? t('wizardGeo_cityTypeaheadPh')
                    : t('wizardGeo_cityNeedsCountry')
                }
                manualOptionLabel={t('wizardGeo_cityManualOption')}
                t={t}
                onSelectResult={handleCitySuggestSelect}
                onSelectManual={handleCityManualSelect}
                onClear={handleCityClear}
              />
            </div>
            {cityUnmatched ? (
              <p className="mt-1.5 text-xs text-slate-500">{t('wizardGeo_cityUnmatchedHint')}</p>
            ) : formData.country && !formData.city ? (
              <p className="mt-1.5 text-xs text-slate-500">{t('wizardGeo_cityBlurManualHint')}</p>
            ) : null}
          </div>
        </div>

        {regions.length > 0 ? (
          <div>
            <Label className="text-sm font-medium">{t('region') || 'Region'}</Label>
            <p className="mt-0.5 text-xs text-slate-500">{t('wizardGeo_regionOptionalHint')}</p>
            <Select
              value={formData.region || undefined}
              onValueChange={handleRegionChange}
              disabled={!formData.country}
            >
              <SelectTrigger className="mt-1.5 h-11">
                <SelectValue placeholder={t('wizardGeo_selectRegion')} />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div
          data-wizard-field="district"
          data-wizard-field-error={errDistrict ? 'true' : undefined}
        >
          <Label className={cn('text-base font-medium', errDistrict && 'text-red-700')}>
            {t('selectDistrict')}
          </Label>
          <Input
            data-testid="wizard-district-input"
            className={cn('mt-2 h-12 min-h-[44px]', wizardFieldErrorClass(stepFieldErrors, 'district'))}
            list="wizard-district-suggestions"
            value={formData.district || ''}
            onChange={(e) => {
              const v = e.target.value
              updateField('district', v)
              if (v && !customDistricts.includes(v)) {
                setCustomDistricts((prev) => (prev.includes(v) ? prev : [...prev, v]))
              }
            }}
            placeholder={t('selectDistrictPlaceholder')}
            aria-invalid={errDistrict || undefined}
          />
          <datalist id="wizard-district-suggestions">
            {districtOptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {errDistrict ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {tr ? tr('wizardBlocker_district') : t('wizardBlocker_district')}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500">{t('wizardGeo_districtHint')}</p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">{t('wizardGeo_addressLabel')}</Label>
          <Input
            className="mt-1.5 h-11"
            value={formData.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder={t('wizardGeo_addressPh')}
          />
        </div>

        <div
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600"
          data-testid="wizard-geo-fx-strip"
          data-currency={currencyInfo.cur}
          data-timezone={currencyInfo.tz}
        >
          <div className="font-medium text-slate-800">{t('wizardGeo_fxReadonlyTitle')}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span data-testid="wizard-geo-fx-currency">
              {t('wizardGeo_currency')}: {currencyInfo.symbol} ({currencyInfo.cur})
            </span>
            <span data-testid="wizard-geo-fx-timezone">
              {t('wizardListingTimezone')}: {currencyInfo.tz}
            </span>
          </div>
          <p className="mt-1 text-slate-500">{t('wizardGeo_fxReadonlyHint')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3 sm:p-4">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm font-medium text-slate-800"
          onClick={() => setAddressSearchOpen((v) => !v)}
          aria-expanded={addressSearchOpen}
        >
          <Search className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="flex-1">{t('wizardGeo_pasteAddressToggle')}</span>
          <span className="text-xs font-normal text-slate-500">
            {addressSearchOpen ? t('wizardGeo_pasteAddressHide') : t('wizardGeo_pasteAddressShow')}
          </span>
        </button>

        {addressSearchOpen ? (
          <div className="mt-3 space-y-2" data-wizard-field="address-search">
            <p className="text-xs text-slate-500">{t('wizardGeo_searchHint')}</p>
            <div className="relative">
              <Input
                placeholder={t('searchAddressPlaceholder')}
                value={geocodeQuery}
                onChange={(e) => onGeocodeQueryChange(e.target.value)}
                className="h-12 border-slate-200 bg-white pr-10"
                autoComplete="off"
              />
              {geocoding ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              ) : (
                <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              )}
            </div>
            {geocodeResults.length > 0 ? (
              <div className="max-h-48 divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                {geocodeResults.map((r, i) => {
                  const levelKey =
                    r.level === 'country'
                      ? 'wizardGeo_levelCountry'
                      : r.level === 'region'
                        ? 'wizardGeo_levelRegion'
                        : r.level === 'city' || r.level === 'neighborhood'
                          ? 'wizardGeo_levelCity'
                          : null
                  const primary = r.labelRu || r.labelEn || r.displayName
                  const secondary =
                    r.labelEn && r.labelRu && r.labelEn !== r.labelRu ? r.labelEn : null
                  return (
                    <button
                      key={`${r.code || ''}-${r.lat}-${r.lon}-${i}`}
                      type="button"
                      className="min-h-[44px] w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => selectGeocodeResult(r)}
                    >
                      <span className="block font-medium text-slate-900">{primary}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                        {levelKey ? <span>{t(levelKey)}</span> : null}
                        {secondary ? <span>{secondary}</span> : null}
                        {!levelKey && r.displayName && r.displayName !== primary ? (
                          <span className="line-clamp-1">{r.displayName}</span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <Label className="text-base font-medium">
          {transportWizard ? t('mapLocationTransport') : t('mapLocation')}
        </Label>
        <p className="mt-1 text-xs text-slate-500">
          {transportWizard ? t('clickToPinTransport') : t('wizardGeo_mapHintAfterCascade')}
        </p>
        <div
          className={cn('mt-2', errCoords && 'rounded-2xl ring-2 ring-red-400 ring-offset-2')}
          data-wizard-field="coordinates"
          data-wizard-field-error={errCoords ? 'true' : undefined}
        >
          <MapPicker
            categoryId={formData.categoryId}
            categorySlug={listingCategorySlug}
            language={language}
            latitude={formData.latitude}
            longitude={formData.longitude}
            onSelect={handleMapSelect}
            height={320}
            countryCode={formData.country || null}
            mapCenter={mapCenter}
            cooperativeTouch="auto"
          />
        </div>
        {errCoords ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">{t('wizardBlocker_coordinates')}</p>
        ) : null}
        {!coordsValid && !errCoords ? (
          <p className="mt-1.5 text-sm text-amber-600">{t('invalidCoords')}</p>
        ) : null}
      </div>
    </div>
  )
}

export const StepLocation = memo(StepLocationInner)
