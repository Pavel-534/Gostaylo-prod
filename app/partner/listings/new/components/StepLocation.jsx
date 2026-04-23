'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useListingWizard } from '../context/ListingWizardContext'

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
  } = w

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
      <div>
        <Label className="text-base font-medium">{t('selectDistrict')}</Label>
        <Select value={formData.district} onValueChange={(v) => updateField('district', v)}>
          <SelectTrigger className="mt-2 h-12">
            <SelectValue placeholder={t('selectDistrictPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {[...WIZARD_DISTRICTS, ...customDistricts.filter((d) => !WIZARD_DISTRICTS.includes(d))].map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
