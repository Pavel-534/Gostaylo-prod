'use client'

import { memo, useEffect, useMemo } from 'react'
import { Info, Zap } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PartnerListingDurationDiscountFields } from '@/components/partner/PartnerListingDurationDiscountFields'
import { PartnerCancellationPolicyPreview } from '@/components/partner/wizard/PartnerCancellationPolicyPreview'
import { WizardPartnerEarningsCalculator } from '@/components/partner/wizard/WizardPartnerEarningsCalculator'
import { getCurrencySymbol } from '@/lib/currency'
import { LISTING_BASE_CURRENCIES } from '@/lib/finance/currency-codes'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'
import { useListingWizard } from '../context/ListingWizardContext'
import { clampIntFromDigits, sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import { cn } from '@/lib/utils'
import { wizardFieldErrorClass, wizardFieldHasError } from '../lib/wizard-field-errors'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
  WIZARD_MOBILE_FLAT_INSET_CLASS,
} from './wizard-step-layout'
import {
  EXCLUSIVE_MANUAL_CALENDAR_META_KEY,
  listingHasEnabledIcalSources,
} from '@/lib/ical/instant-booking-ical-policy.js'
import { getSiteDisplayName } from '@/lib/site-url.js'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'

function StepPricingInner() {
  const w = useListingWizard()
  const {
    t,
    tr,
    formData,
    updateField,
    updateMetadata,
    updateDurationDiscountPercent,
    partnerCommissionRate,
    baseCurrencyLocked,
    transportWizard,
    toursWizard,
    language,
    stepFieldErrors,
    serverListing,
    setCurrentStep,
  } = w
  const baseCurrency = String(formData.baseCurrency || 'THB').toUpperCase()
  const countryCode = String(formData.country || '').trim().toUpperCase().slice(0, 2)
  const currencyFromCountry = countryCode ? getDefaultListingBaseCurrency(countryCode) : null
  const currencyLockedToCountry = Boolean(currencyFromCountry) && !baseCurrencyLocked

  // Stage 200.86 — listing currency = country (Airbnb-style); no free THB for RU
  useEffect(() => {
    if (!currencyFromCountry) return
    if (baseCurrencyLocked) return
    if (String(formData.baseCurrency || '').toUpperCase() === currencyFromCountry) return
    updateField('baseCurrency', currencyFromCountry)
  }, [currencyFromCountry, baseCurrencyLocked, formData.baseCurrency, updateField])

  const currencySymbol = getCurrencySymbol(baseCurrency)
  const errPrice = wizardFieldHasError(stepFieldErrors, 'basePriceThb')
  const hasIcal = listingHasEnabledIcalSources(serverListing?.sync_settings || serverListing?.syncSettings)
  const exclusiveAck = formData.metadata?.[EXCLUSIVE_MANUAL_CALENDAR_META_KEY] === true
  const brand = getSiteDisplayName()

  const periodLabel = useMemo(() => {
    if (transportWizard) return t('wizardPriceCalcPeriodBookingDay')
    if (toursWizard) return t('wizardPriceCalcPeriodTour')
    return t('wizardPriceCalcPeriodNight')
  }, [transportWizard, toursWizard, t])

  const basePriceLabel = useMemo(() => {
    if (transportWizard) {
      return tr('basePriceVehicle', { unit: `${currencySymbol}/${t('wizardPriceCalcPeriodNight')}` })
    }
    if (toursWizard) {
      return tr('basePriceTour', { currency: currencySymbol })
    }
    return tr('basePrice', { unit: `${currencySymbol}/${t('wizardPriceCalcPeriodNight')}` })
  }, [transportWizard, toursWizard, currencySymbol, tr, t])

  return (
    <TooltipProvider>
      <div className={cn(WIZARD_STEP_ROOT_CLASS, 'space-y-0')}>
        <div className="space-y-2">
          <h2 className={WIZARD_STEP_TITLE_CLASS}>{t('pricingAndBooking')}</h2>
          <p className={`leading-relaxed ${WIZARD_STEP_SUBTITLE_CLASS}`}>{t('setRates')}</p>
        </div>

        <div
          className={cn(
            WIZARD_MOBILE_FLAT_INSET_CLASS,
            'mt-6 flex items-start justify-between gap-4 rounded-2xl border p-4 transition-colors',
            formData.instantBooking === true
              ? 'border-brand/40 bg-brand/10 ring-1 ring-brand/25'
              : 'border-brand/30 bg-brand/5 sm:border-brand/35',
          )}
          data-testid="partner-listing-instant-booking"
          data-partner-section="pricing-instant"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                formData.instantBooking === true
                  ? 'bg-brand text-white'
                  : 'bg-brand/15 text-brand',
              )}
              aria-hidden
            >
              <Zap className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Label
                  htmlFor="partner-instant-booking"
                  className="text-base font-semibold text-slate-900"
                >
                  {t('partnerListing_instantBookingTitle')}
                </Label>
                <span className="inline-flex items-center rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
                  {t('partnerListing_instantBookingBadge')}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                {transportWizard
                  ? t('partnerListing_instantBookingHintVehicle')
                  : t('partnerListing_instantBookingHint')}
              </p>
            </div>
          </div>
          <Switch
            id="partner-instant-booking"
            checked={formData.instantBooking === true}
            onCheckedChange={(checked) => {
              const on = checked === true
              updateField('instantBooking', on)
              if (!on) {
                updateMetadata(EXCLUSIVE_MANUAL_CALENDAR_META_KEY, false)
              }
            }}
            className="mt-1 min-h-[44px] min-w-[44px] shrink-0 data-[state=checked]:bg-brand"
            aria-label={t('partnerListing_instantBookingTitle')}
          />
        </div>

        {formData.instantBooking === true && !hasIcal ? (
          <div
            className={cn(
              WIZARD_MOBILE_FLAT_INSET_CLASS,
              'mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4',
            )}
            data-testid="partner-listing-exclusive-calendar-ack"
          >
            <Checkbox
              id="partner-exclusive-calendar"
              checked={exclusiveAck}
              onCheckedChange={(v) =>
                updateMetadata(EXCLUSIVE_MANUAL_CALENDAR_META_KEY, v === true)
              }
              className="mt-1 min-h-[44px] min-w-[44px] data-[state=checked]:bg-brand data-[state=checked]:border-brand"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="partner-exclusive-calendar" className="text-sm font-semibold text-slate-900">
                {tr('partnerListing_exclusiveCalendarAck', { brand })}
              </Label>
              <p className="text-xs leading-relaxed text-slate-600">
                {transportWizard
                  ? t('partnerListing_exclusiveCalendarHintVehicle')
                  : t('partnerListing_exclusiveCalendarHint')}
              </p>
            </div>
          </div>
        ) : null}

        <PartnerSectionDivider />

        <div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2"
          data-partner-section="pricing-base"
        >
          <div
            data-wizard-field="basePriceThb"
            data-wizard-field-error={errPrice ? 'true' : undefined}
          >
            <Label
              className={cn(PARTNER_FIELD_LABEL_CLASS, errPrice && 'text-red-700')}
            >
              {basePriceLabel}
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder={toursWizard ? t('basePriceTourPlaceholder') : t('basePricePlaceholder')}
              value={formData.basePriceThb}
              onChange={(e) => updateField('basePriceThb', sanitizeThbDigits(e.target.value))}
              className={cn('mt-2 h-12 w-full', wizardFieldErrorClass(stepFieldErrors, 'basePriceThb'))}
              aria-invalid={errPrice || undefined}
            />
            {errPrice ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                {tr ? tr('wizardBlocker_price') : t('wizardBlocker_price')}
              </p>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('wizardBaseCurrencyLabel')}</Label>
              {baseCurrencyLocked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={t('wizardBaseCurrencyLockedActiveBookings')}
                    >
                      <Info className="h-4 w-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-sm leading-snug">
                    {t('wizardBaseCurrencyLockedActiveBookings')}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <Select
              value={formData.baseCurrency || currencyFromCountry || 'USD'}
              onValueChange={(v) => updateField('baseCurrency', v)}
              disabled={baseCurrencyLocked || currencyLockedToCountry}
            >
              <SelectTrigger
                className={cn(
                  'mt-2 h-12 w-full',
                  (baseCurrencyLocked || currencyLockedToCountry) && 'cursor-not-allowed opacity-60',
                )}
                aria-disabled={baseCurrencyLocked || currencyLockedToCountry}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LISTING_BASE_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} ({getCurrencySymbol(code)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {baseCurrencyLocked ? (
              <p className="mt-1.5 text-xs leading-relaxed text-amber-800">{t('wizardBaseCurrencyLockedActiveBookings')}</p>
            ) : currencyLockedToCountry ? (
              <p className="mt-1.5 text-xs text-slate-500">{t('wizardBaseCurrencyFromCountryHint')}</p>
            ) : null}
          </div>
        </div>

        <PartnerSectionDivider />

        <div data-partner-section="pricing-earnings">
          <WizardPartnerEarningsCalculator
            t={t}
            tr={tr}
            baseAmount={formData.basePriceThb}
            baseCurrency={baseCurrency}
            hostCommissionPercent={partnerCommissionRate ?? 0}
            periodLabel={periodLabel}
          />
        </div>

        <PartnerSectionDivider />

        <div className="space-y-2" data-partner-section="pricing-cancellation">
          <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerEdit_cancellationPolicy')}</h3>
          <Select
            value={formData.cancellationPolicy || 'moderate'}
            onValueChange={(value) => updateField('cancellationPolicy', value)}
          >
            <SelectTrigger className="h-12 w-full sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flexible">{t('partnerEdit_cancelPol_flexible')}</SelectItem>
              <SelectItem value="moderate">{t('partnerEdit_cancelPol_moderate')}</SelectItem>
              <SelectItem value="strict">{t('partnerEdit_cancelPol_strict')}</SelectItem>
            </SelectContent>
          </Select>
          <PartnerCancellationPolicyPreview
            policy={formData.cancellationPolicy || 'moderate'}
            language={language}
          />
          <p className="text-xs text-slate-500">{t('partnerEdit_cancellationPolicyHint')}</p>
        </div>

        <PartnerSectionDivider />

        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2"
          data-partner-section="pricing-stay-window"
        >
          <div>
            <Label className={PARTNER_FIELD_LABEL_CLASS}>
              {transportWizard ? t('minStayVehicle') : toursWizard ? t('minStayTourGroup') : t('minStay')}
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={
                toursWizard ? String(formData.metadata?.group_size_min ?? 1) : String(formData.minBookingDays)
              }
              onChange={(e) => {
                if (toursWizard) {
                  const v = clampIntFromDigits(e.target.value, 1, 999, 1)
                  updateMetadata('group_size_min', v)
                  const curMax = clampIntFromDigits(
                    formData.metadata?.group_size_max ?? v,
                    1,
                    999,
                    Math.max(v, 10),
                  )
                  if (curMax < v) updateMetadata('group_size_max', v)
                } else {
                  updateField('minBookingDays', clampIntFromDigits(e.target.value, 1, 365, 1))
                }
              }}
              className="mt-2 h-12 w-full"
            />
          </div>
          <div>
            <Label className={PARTNER_FIELD_LABEL_CLASS}>
              {transportWizard ? t('maxStayVehicle') : toursWizard ? t('maxStayTourGroup') : t('maxStay')}
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={
                toursWizard
                  ? String(
                      formData.metadata?.group_size_max ?? Math.max(formData.metadata?.group_size_min ?? 1, 10),
                    )
                  : String(formData.maxBookingDays)
              }
              onChange={(e) => {
                if (toursWizard) {
                  const gmin = clampIntFromDigits(formData.metadata?.group_size_min ?? 1, 1, 999, 1)
                  const raw = clampIntFromDigits(e.target.value, 1, 999, Math.max(gmin, 10))
                  updateMetadata('group_size_max', Math.max(gmin, raw))
                } else {
                  updateField('maxBookingDays', clampIntFromDigits(e.target.value, 1, 730, 90))
                }
              }}
              className="mt-2 h-12 w-full"
            />
          </div>
        </div>
        {toursWizard ? (
          <p
            className={cn(
              WIZARD_MOBILE_FLAT_INSET_CLASS,
              'mt-3 text-xs leading-relaxed text-slate-600 sm:bg-slate-50',
            )}
          >
            {t('partnerTourMinMaxBackendHint')}
          </p>
        ) : null}
        {!toursWizard ? (
          <div className="mt-5" data-partner-section="pricing-discounts">
            <PartnerListingDurationDiscountFields
              metadata={formData.metadata}
              language={w.language}
              onChangeDiscount={updateDurationDiscountPercent}
              rentalPeriodDays={transportWizard}
            />
          </div>
        ) : null}

        <PartnerSectionDivider />

        <div
          className={cn(
            WIZARD_MOBILE_FLAT_INSET_CLASS,
            'space-y-2 rounded-2xl border border-slate-200/90 p-4 sm:bg-slate-50/80',
          )}
          data-testid="wizard-pricing-seasons-pointer"
          data-partner-section="pricing-seasons"
        >
          <p className={PARTNER_FIELD_LABEL_CLASS}>{t('seasonalPricing')}</p>
          <p className="text-sm leading-relaxed text-slate-600">{t('wizardPricing_seasonsOnCalendarStep')}</p>
          <button
            type="button"
            className="min-h-[44px] text-sm font-semibold text-brand underline-offset-2 hover:underline"
            onClick={() => setCurrentStep?.(5)}
            data-testid="wizard-pricing-go-calendar"
          >
            {t('wizardPricing_goToCalendarStep')}
          </button>
        </div>
      </div>
    </TooltipProvider>
  )
}

export const StepPricing = memo(StepPricingInner)
