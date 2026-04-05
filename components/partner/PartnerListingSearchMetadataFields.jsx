'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUIText } from '@/lib/translations'
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { NANNY_LANG_OPTIONS } from '@/lib/search/nanny-search-langs'
import { isPartnerListingHousingCategory } from '@/lib/partner/listing-wizard-metadata'
import { cn } from '@/lib/utils'

function langOptionLabel(row, language) {
  return row[language] || row.en
}

export function PartnerListingSearchMetadataFields({
  categorySlug = '',
  categoryNameFallback = '',
  language = 'ru',
  metadata = {},
  updateMetadata,
  variant = 'wizard',
  showWizardExtraHousingFields = true,
}) {
  const t = (key) => getUIText(key, language)
  const slug = String(categorySlug || '').toLowerCase()
  const name = String(categoryNameFallback || '')

  const showHousing = isPartnerListingHousingCategory(slug, name)
  const showVehicles =
    isTransportListingCategory(slug) ||
    /vehicle|транспорт|bike|moto|car|авто|байк|мото/i.test(name)
  const showNanny = slug === 'nanny' || slug === 'babysitter' || /nanny|нян|babysit/i.test(name)

  if (!showHousing && !showVehicles && !showNanny) return null

  const langs = Array.isArray(metadata.languages) ? metadata.languages : []
  const langSet = new Set(langs.map((x) => String(x).toLowerCase()))

  const toggleLang = (id) => {
    const next = new Set(langSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateMetadata('languages', [...next])
  }

  const hint = (
    <p className="rounded-r-md border-l-[3px] border-teal-500 bg-teal-50/50 py-2 pl-3 text-sm leading-relaxed text-slate-600">
      {isTransportListingCategory(slug)
        ? t('wizardSpecsVehicleSearchHint')
        : variant === 'edit'
          ? t('partnerEdit_searchMetadataHint')
          : t('wizardSpecsSearchHint')}
    </p>
  )

  const housingBlock =
    showHousing &&
    (variant === 'wizard' ? (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">{t('fieldBedrooms')}</Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={String(metadata.bedrooms ?? 0)}
              onChange={(e) =>
                updateMetadata('bedrooms', clampIntFromDigits(e.target.value, 0, 99, 0))
              }
              className="mt-2 h-11"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t('fieldBathrooms')}</Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={String(metadata.bathrooms ?? 0)}
              onChange={(e) =>
                updateMetadata('bathrooms', clampIntFromDigits(e.target.value, 0, 99, 0))
              }
              className="mt-2 h-11"
            />
          </div>
        </div>
        {showWizardExtraHousingFields && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t('fieldMaxGuests')}</Label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={String(metadata.max_guests ?? 2)}
                onChange={(e) =>
                  updateMetadata('max_guests', clampIntFromDigits(e.target.value, 1, 999, 1))
                }
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t('fieldAreaSqm')}</Label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={String(metadata.area ?? 0)}
                onChange={(e) =>
                  updateMetadata('area', clampIntFromDigits(e.target.value, 0, 9_999_999, 0))
                }
                className="mt-2 h-11"
              />
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label className="text-sm font-medium text-slate-700">{t('fieldBedrooms')}</Label>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={String(metadata.bedrooms ?? 0)}
            onChange={(e) =>
              updateMetadata('bedrooms', clampIntFromDigits(e.target.value, 0, 99, 0))
            }
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700">{t('fieldBathrooms')}</Label>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={String(metadata.bathrooms ?? 0)}
            onChange={(e) =>
              updateMetadata('bathrooms', clampIntFromDigits(e.target.value, 0, 99, 0))
            }
            className="mt-2 h-11"
          />
        </div>
      </div>
    ))

  const transmissionFuelRow = (
    <>
      <div>
        <Label className="text-sm font-medium text-slate-700">{t('fieldTransmission')}</Label>
        <Select
          value={metadata.transmission ? String(metadata.transmission).toLowerCase() : 'unset'}
          onValueChange={(v) => updateMetadata('transmission', v === 'unset' ? '' : v)}
        >
          <SelectTrigger className="mt-2 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">{t('transmissionUnset')}</SelectItem>
            <SelectItem value="automatic">{t('transmissionAuto')}</SelectItem>
            <SelectItem value="manual">{t('transmissionManual')}</SelectItem>
            <SelectItem value="cvt">{t('transmissionCvt')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">{t('fieldFuelType')}</Label>
        <Select
          value={metadata.fuel_type ? String(metadata.fuel_type).toLowerCase() : 'unset'}
          onValueChange={(v) => updateMetadata('fuel_type', v === 'unset' ? '' : v)}
        >
          <SelectTrigger className="mt-2 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">{t('fuelUnset')}</SelectItem>
            <SelectItem value="petrol">{t('fuelPetrol')}</SelectItem>
            <SelectItem value="diesel">{t('fuelDiesel')}</SelectItem>
            <SelectItem value="electric">{t('fuelElectric')}</SelectItem>
            <SelectItem value="hybrid">{t('fuelHybrid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )

  const engineCcField = (
    <div className={isTransportListingCategory(slug) ? '' : 'sm:col-span-2'}>
      <Label className="text-sm font-medium text-slate-700">{t('fieldEngineCc')}</Label>
      <Input
        inputMode="numeric"
        autoComplete="off"
        placeholder="125"
        value={
          metadata.engine_cc != null && metadata.engine_cc !== '' ? String(metadata.engine_cc) : ''
        }
        onChange={(e) => {
          const v = clampIntFromDigits(e.target.value, 0, 500_000, undefined)
          if (v === undefined) updateMetadata('engine_cc', '')
          else updateMetadata('engine_cc', v)
        }}
        className="mt-2 h-11"
      />
    </div>
  )

  const vehicleYearSeatsRow = isTransportListingCategory(slug) && (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <Label className="text-sm font-medium text-slate-700">{t('fieldVehicleYear')}</Label>
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder="2022"
          value={
            metadata.vehicle_year != null && metadata.vehicle_year !== ''
              ? String(metadata.vehicle_year)
              : ''
          }
          onChange={(e) => {
            const d = String(e.target.value ?? '').replace(/\D/g, '').slice(0, 4)
            updateMetadata('vehicle_year', d)
          }}
          onBlur={() => {
            const raw = String(metadata.vehicle_year ?? '').replace(/\D/g, '')
            if (!raw) {
              updateMetadata('vehicle_year', '')
              return
            }
            const n = parseInt(raw, 10)
            if (!Number.isFinite(n) || n < 1985) {
              updateMetadata('vehicle_year', '')
              return
            }
            updateMetadata('vehicle_year', Math.min(2100, n))
          }}
          className="mt-2 h-11"
        />
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">{t('fieldVehicleSeats')}</Label>
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder="4"
          value={metadata.seats != null && metadata.seats !== '' ? String(metadata.seats) : ''}
          onChange={(e) => {
            const v = clampIntFromDigits(e.target.value, 1, 99, undefined)
            if (v === undefined) updateMetadata('seats', '')
            else updateMetadata('seats', v)
          }}
          className="mt-2 h-11"
        />
      </div>
    </div>
  )

  const vehiclesBlock = showVehicles && (
    <div className="space-y-5">
      {isTransportListingCategory(slug) ? (
        <>
          {vehicleYearSeatsRow}
          {engineCcField}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{transmissionFuelRow}</div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {transmissionFuelRow}
          {engineCcField}
        </div>
      )}
    </div>
  )

  const nannyBlock = showNanny && (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t('fieldNannyLanguages')}</Label>
        <div className="flex flex-wrap gap-2">
          {NANNY_LANG_OPTIONS.map((row) => {
            const checked = langSet.has(row.id)
            return (
              <label
                key={row.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200',
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggleLang(row.id)} />
                {langOptionLabel(row, language)}
              </label>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label className="text-sm font-medium text-slate-700">{t('fieldExperienceYears')}</Label>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={
              metadata.experience_years != null && metadata.experience_years !== ''
                ? String(metadata.experience_years)
                : ''
            }
            onChange={(e) => {
              const v = clampIntFromDigits(e.target.value, 0, 80, undefined)
              if (v === undefined) updateMetadata('experience_years', '')
              else updateMetadata('experience_years', v)
            }}
            className="mt-2 h-11"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-sm font-medium text-slate-700">{t('fieldSpecialization')}</Label>
          <Input
            type="text"
            placeholder={t('fieldSpecializationPh')}
            value={metadata.specialization || ''}
            onChange={(e) => updateMetadata('specialization', e.target.value)}
            className="mt-2 h-11"
          />
        </div>
      </div>
    </div>
  )

  const inner = (
    <div className="space-y-6">
      {hint}
      {housingBlock}
      {vehiclesBlock}
      {nannyBlock}
    </div>
  )

  if (variant === 'edit') {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold tracking-tight">
            {t('partnerEdit_searchMetadataSection')}
          </CardTitle>
        </CardHeader>
        <CardContent>{inner}</CardContent>
      </Card>
    )
  }

  return inner
}
