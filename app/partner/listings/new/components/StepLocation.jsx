'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useListingWizard } from '../context/ListingWizardContext'
import { guessIanaTimezoneFromLatLon } from '@/lib/geo/listing-timezone-guess'
import { WIZARD_IANA_TIMEZONES } from '@/lib/geo/wizard-iana-timezones'
import {
  COUNTRY_PRESETS,
  findCountry,
  findRegion,
  findCity,
  getLabel,
} from '@/lib/geo/country-presets'

const MapPicker = dynamic(() => import('@/components/listing/MapPicker'), { ssr: false })

function StepLocationInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
    updateField,
    WIZARD_DISTRICTS,
    customDistricts,
    transportWizard,
    listingCategorySlug,
    language,
    geocodeQuery,
    setGeocodeQuery,
    geocodeResults,
    geocoding,
    handleGeocode,
    selectGeocodeResult,
    handleMapSelect,
    coordsValid,
    updateMetadata,
  } = w

  // GP-1 cascade: Country → Region → City → District
  const country = findCountry(formData.country) || COUNTRY_PRESETS[0]
  const region = findRegion(formData.country, formData.region) || country.regions[0]
  const city = findCity(formData.country, formData.region, formData.city) || region.cities[0]

  const cityDistricts = (() => {
    const fromPreset = city?.districts || []
    // Сохраняем custom-районы (geocode) и backward-compat с WIZARD_DISTRICTS если страна = TH
    const legacy = formData.country === 'TH' ? WIZARD_DISTRICTS : []
    return Array.from(new Set([...fromPreset, ...legacy, ...customDistricts]))
  })()

  const handleCountryChange = (code) => {
    const c = findCountry(code)
    if (!c) return
    const r = c.regions[0]
    const ci = r?.cities?.[0]
    updateField('country', c.code)
    updateField('region', r?.code || '')
    updateField('city', ci?.code || '')
    updateField('district', '')
  }
  const handleRegionChange = (code) => {
    const r = findRegion(formData.country, code)
    const ci = r?.cities?.[0]
    updateField('region', r?.code || '')
    updateField('city', ci?.code || '')
    updateField('district', '')
  }
  const handleCityChange = (code) => {
    updateField('city', code)
    updateField('district', '')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">
          {transportWizard ? t('whereIsListingTransport') : t('whereIsListing')}
        </h2>
        <p className="text-slate-600">
          {transportWizard ? t('helpGuestsFindTransport') : t('helpGuestsFind')}
        </p>
      </div>

      {/* GP-1 cascade: Country → Region → City */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-sm font-medium">{t('country') || 'Country'}</Label>
          <Select value={formData.country || 'TH'} onValueChange={handleCountryChange}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_PRESETS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="mr-2" aria-hidden>{c.flag}</span>
                  {getLabel(c, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">{t('region') || 'Region'}</Label>
          <Select value={formData.region || region.code} onValueChange={handleRegionChange}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {country.regions.map((r) => (
                <SelectItem key={r.code} value={r.code}>{getLabel(r, language)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">{t('city') || 'City'}</Label>
          <Select value={formData.city || city.code} onValueChange={handleCityChange}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {region.cities.map((ci) => (
                <SelectItem key={ci.code} value={ci.code}>{getLabel(ci, language)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-base font-medium">{t('selectDistrict')}</Label>
        <Select value={formData.district} onValueChange={(v) => updateField('district', v)}>
          <SelectTrigger className="mt-2 h-12">
            <SelectValue placeholder={t('selectDistrictPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {cityDistricts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-slate-500">
          {t('districtHintGlobal') ||
            'Выберите район/окрестность внутри города. Список зависит от выбранного города выше.'}
        </p>
      </div>
      <div>
        <Label className="text-base font-medium">{t('searchAddress')}</Label>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder={t('searchAddressPlaceholder')}
            value={geocodeQuery}
            onChange={(e) => setGeocodeQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleGeocode} disabled={geocoding} type="button">
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : t('search')}
          </Button>
        </div>
        {geocodeResults.length > 0 && (
          <div className="mt-2 max-h-40 divide-y overflow-y-auto rounded-lg border">
            {geocodeResults.map((r, i) => (
              <button
                key={i}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => selectGeocodeResult(r)}
              >
                {r.displayName}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label className="text-base font-medium">
          {transportWizard ? t('mapLocationTransport') : t('mapLocation')}
        </Label>
        <p className="mt-1 text-xs text-slate-500">
          {transportWizard ? t('clickToPinTransport') : t('clickToPin')}
        </p>
        <div className="mt-2">
          <MapPicker
            categoryId={formData.categoryId}
            categorySlug={listingCategorySlug}
            language={language}
            latitude={formData.latitude}
            longitude={formData.longitude}
            onSelect={handleMapSelect}
            height={280}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-base font-medium">{t('wizardListingTimezone')}</Label>
        <p className="text-xs text-slate-500">{t('wizardListingTimezoneHint')}</p>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
          <Select
            value={String(formData.metadata?.timezone || 'Asia/Bangkok')}
            onValueChange={(v) => updateMetadata('timezone', v)}
          >
            <SelectTrigger className="mt-1 h-11 sm:flex-1 sm:mt-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {WIZARD_IANA_TIMEZONES.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={formData.latitude == null || formData.longitude == null}
            onClick={() => {
              const z = guessIanaTimezoneFromLatLon(formData.latitude, formData.longitude)
              if (z) updateMetadata('timezone', z)
            }}
          >
            {t('wizardTimezoneAutoFromMap')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">{t('latitude')}</Label>
          <Input
            type="number"
            step="any"
            placeholder="7.8235"
            value={formData.latitude ?? ''}
            onChange={(e) => updateField('latitude', e.target.value ? parseFloat(e.target.value) : null)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm">{t('longitude')}</Label>
          <Input
            type="number"
            step="any"
            placeholder="98.3828"
            value={formData.longitude ?? ''}
            onChange={(e) => updateField('longitude', e.target.value ? parseFloat(e.target.value) : null)}
            className="mt-1"
          />
        </div>
      </div>
      {!coordsValid && <p className="text-sm text-amber-600">{t('invalidCoords')}</p>}
    </div>
  )
}

export const StepLocation = memo(StepLocationInner)
