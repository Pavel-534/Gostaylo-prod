'use client'

/**
 * Stage 200.36 / 200.43 — Location step: cascade-first UX (Country → Region → City → District → Address).
 * Address search + map remain accelerators; geo_locations / anti-coerce unchanged.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, MapPin, AlertTriangle, Search } from 'lucide-react'
import { useListingWizard } from '../context/ListingWizardContext'
import { LAUNCH_MARKETS } from '@/lib/geo/wizard-geo-from-pin'
import { COUNTRY_CURRENCY_TZ } from '@/lib/geo/launch-markets-seed-data'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
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

function StepLocationInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
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

  const [countries, setCountries] = useState([])
  const [regions, setRegions] = useState([])
  const [cities, setCities] = useState([])
  const [geoUnavailable, setGeoUnavailable] = useState(false)
  const [cityManual, setCityManual] = useState(
    () => String(formData.metadata?.city_label || formData.metadata?.city || ''),
  )
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)
  const debounceRef = useRef(null)
  const [mapCenter, setMapCenter] = useState(null)

  const cityUnmatched =
    formData.metadata?.geo_city_unmatched === true ||
    (!formData.city && Boolean(String(formData.metadata?.city_label || '').trim()))

  const launchOk = !formData.country || LAUNCH_MARKETS.has(String(formData.country).toUpperCase())

  const currencyInfo = useMemo(() => {
    const iso = String(formData.country || '').toUpperCase()
    const cur =
      formData.baseCurrency ||
      COUNTRY_CURRENCY_TZ[iso]?.currency ||
      'THB'
    const tz =
      formData.metadata?.timezone ||
      COUNTRY_CURRENCY_TZ[iso]?.timezone ||
      '—'
    return { cur, tz, symbol: getCurrencySymbol(cur) }
  }, [formData.country, formData.baseCurrency, formData.metadata?.timezone])

  const districtOptions = useMemo(() => {
    const set = new Set(
      [...customDistricts, formData.district].filter((d) => String(d || '').trim()),
    )
    return Array.from(set)
  }, [customDistricts, formData.district])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchGeoNodes({ level: 'country', lang: language })
        if (!cancelled) setCountries(rows)
      } catch {
        if (!cancelled) setGeoUnavailable(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [language])

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
        const cRow = countries.find((c) => c.code === cc)
        if (cRow?.centroidLat != null && cRow?.centroidLng != null) {
          setMapCenter([cRow.centroidLat, cRow.centroidLng])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formData.country, language, countries])

  useEffect(() => {
    const rc = formData.region
    if (!rc) {
      setCities([])
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const rows = await fetchGeoNodes({ parent: rc, lang: language })
      if (!cancelled) {
        setCities(rows.filter((r) => r.level === 'city' || r.level === 'neighborhood'))
        const rRow = regions.find((r) => r.code === rc)
        if (rRow?.centroidLat != null && rRow?.centroidLng != null) {
          setMapCenter([rRow.centroidLat, rRow.centroidLng])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formData.region, language, regions])

  useEffect(() => {
    const label = String(formData.metadata?.city_label || formData.metadata?.city || '')
    if (label && label !== cityManual) setCityManual(label)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from pin/metadata only
  }, [formData.metadata?.city_label, formData.metadata?.city])

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

  const handleCountryChange = (code) => {
    updateField('country', code)
    updateField('region', '')
    updateField('city', '')
    updateField('district', '')
    setCityManual('')
    updateMetadata('city_label', '')
    updateMetadata('geo_city_unmatched', false)
    const ct = COUNTRY_CURRENCY_TZ[code]
    if (ct?.timezone) updateMetadata('timezone', ct.timezone)
    if (!baseCurrencyLocked && ct?.currency) updateField('baseCurrency', ct.currency)
  }

  const handleRegionChange = (code) => {
    updateField('region', code)
    updateField('city', '')
    updateField('district', '')
    setCityManual('')
    updateMetadata('geo_city_unmatched', false)
  }

  const handleCitySelect = (code) => {
    if (code === '__manual__') {
      updateField('city', '')
      updateMetadata('geo_city_unmatched', true)
      return
    }
    updateField('city', code)
    const row = cities.find((c) => c.code === code)
    if (row?.label) {
      setCityManual(row.label)
      updateMetadata('city_label', row.label)
      updateMetadata('city', row.label)
    }
    updateMetadata('geo_city_unmatched', false)
    updateField('district', '')
    if (row?.centroidLat != null && row?.centroidLng != null) {
      setMapCenter([row.centroidLat, row.centroidLng])
    }
  }

  const onCityManualBlur = () => {
    const label = String(cityManual || '').trim()
    updateMetadata('city_label', label)
    updateMetadata('city', label)
    if (label && !formData.city) {
      updateMetadata('geo_city_unmatched', true)
    }
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

      {/* A — Primary cascade (what partners expect) */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('wizardGeo_cascadeTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('wizardGeo_cascadeHint')}</p>
        </div>

        {!launchOk ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{t('wizardGeo_nonLaunchWarning')}</AlertDescription>
          </Alert>
        ) : null}

        {geoUnavailable ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('wizardGeo_serviceDownTitle')}</AlertTitle>
            <AlertDescription className="text-xs">{t('wizardGeo_serviceDownBody')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div data-wizard-field="country" data-wizard-field-error={errCountry ? 'true' : undefined}>
            <Label className={cn('text-sm font-medium', errCountry && 'text-red-700')}>
              {t('country') || 'Country'}
            </Label>
            <Select value={formData.country || undefined} onValueChange={handleCountryChange}>
              <SelectTrigger
                className={cn('mt-1.5 h-11', wizardFieldErrorClass(stepFieldErrors, 'country'))}
              >
                <SelectValue placeholder={t('wizardGeo_selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">{t('region') || 'Region'}</Label>
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
          <div data-wizard-field="city" data-wizard-field-error={errCity ? 'true' : undefined}>
            <Label className={cn('text-sm font-medium', errCity && 'text-red-700')}>
              {t('city') || 'City'}
            </Label>
            <Select
              value={formData.city || (cityUnmatched ? '__manual__' : undefined)}
              onValueChange={handleCitySelect}
              disabled={!formData.region && cities.length === 0}
            >
              <SelectTrigger
                className={cn('mt-1.5 h-11', wizardFieldErrorClass(stepFieldErrors, 'city'))}
              >
                <SelectValue placeholder={t('wizardGeo_selectCity')} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((ci) => (
                  <SelectItem key={ci.code} value={ci.code}>
                    {ci.label}
                  </SelectItem>
                ))}
                <SelectItem value="__manual__">{t('wizardGeo_cityManualOption')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {cityUnmatched ? (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('wizardGeo_cityManualLabel')}</Label>
            <Input
              className="h-11"
              value={cityManual}
              onChange={(e) => setCityManual(e.target.value)}
              onBlur={onCityManualBlur}
              placeholder={t('wizardGeo_cityManualPh')}
            />
            <p className="text-xs text-slate-500">{t('wizardGeo_cityUnmatchedHint')}</p>
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
            className={cn('mt-2 h-12', wizardFieldErrorClass(stepFieldErrors, 'district'))}
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div className="font-medium text-slate-800">{t('wizardGeo_fxReadonlyTitle')}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {t('wizardGeo_currency')}: {currencyInfo.symbol} ({currencyInfo.cur})
            </span>
            <span>
              {t('wizardListingTimezone')}: {currencyInfo.tz}
            </span>
          </div>
          <p className="mt-1 text-slate-500">{t('wizardGeo_fxReadonlyHint')}</p>
        </div>
      </div>

      {/* B — Optional address paste (accelerator) */}
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

      {/* C — Map (refine pin) */}
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
