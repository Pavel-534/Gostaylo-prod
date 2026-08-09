'use client'

import { memo, useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { DollarSign, Info } from 'lucide-react'
import { toast } from 'sonner'
import { getSeasonColor } from '@/lib/price-calculator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PartnerListingDurationDiscountFields } from '@/components/partner/PartnerListingDurationDiscountFields'
import { PartnerCancellationPolicyPreview } from '@/components/partner/wizard/PartnerCancellationPolicyPreview'
import { WizardPartnerEarningsCalculator } from '@/components/partner/wizard/WizardPartnerEarningsCalculator'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'
import { getCurrencySymbol } from '@/lib/currency'
import { LISTING_BASE_CURRENCIES } from '@/lib/finance/currency-codes'
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

function StepPricingInner() {
  const w = useListingWizard()
  const {
    t,
    tr,
    formData,
    setFormData,
    updateField,
    updateMetadata,
    updateDurationDiscountPercent,
    partnerCommissionRate,
    baseCurrencyLocked,
    transportWizard,
    toursWizard,
    SEASON_TYPES,
    newSeason,
    setNewSeason,
    dayPickerLocale,
    language,
    stepFieldErrors,
    serverListing,
  } = w
  const baseCurrency = String(formData.baseCurrency || 'THB').toUpperCase()
  const { formatInListingBase } = useStorefrontDisplayFx()
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
      <div className={cn(WIZARD_STEP_ROOT_CLASS, 'space-y-8')}>
        <div className="space-y-2">
          <h2 className={WIZARD_STEP_TITLE_CLASS}>{t('pricingAndBooking')}</h2>
          <p className={`leading-relaxed ${WIZARD_STEP_SUBTITLE_CLASS}`}>{t('setRates')}</p>
        </div>

        <div
          className={cn(
            WIZARD_MOBILE_FLAT_INSET_CLASS,
            'flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:border-slate-200/90',
          )}
          data-testid="partner-listing-instant-booking"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Label
              htmlFor="partner-instant-booking"
              className="text-base font-semibold text-slate-900"
            >
              {t('partnerListing_instantBookingTitle')}
            </Label>
            <p className="text-sm leading-relaxed text-slate-600">
              {t('partnerListing_instantBookingHint')}
            </p>
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
            className="mt-1 shrink-0 data-[state=checked]:bg-brand"
            aria-label={t('partnerListing_instantBookingTitle')}
          />
        </div>

        {formData.instantBooking === true && !hasIcal ? (
          <div
            className={cn(
              WIZARD_MOBILE_FLAT_INSET_CLASS,
              'flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4',
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
                {t('partnerListing_exclusiveCalendarHint')}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div
            data-wizard-field="basePriceThb"
            data-wizard-field-error={errPrice ? 'true' : undefined}
          >
            <Label
              className={cn('text-base font-medium text-slate-800', errPrice && 'text-red-700')}
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
              <Label className="text-base font-medium text-slate-800">{t('wizardBaseCurrencyLabel')}</Label>
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
              value={formData.baseCurrency || 'THB'}
              onValueChange={(v) => updateField('baseCurrency', v)}
              disabled={baseCurrencyLocked}
            >
              <SelectTrigger
                className={cn('mt-2 h-12 w-full', baseCurrencyLocked && 'cursor-not-allowed opacity-60')}
                aria-disabled={baseCurrencyLocked}
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
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t('wizardBaseCurrencyFxHint')}</p>
            )}
          </div>
        </div>

        <WizardPartnerEarningsCalculator
          t={t}
          tr={tr}
          baseAmount={formData.basePriceThb}
          baseCurrency={baseCurrency}
          hostCommissionPercent={partnerCommissionRate ?? 0}
          periodLabel={periodLabel}
        />

        <div className="space-y-2">
          <Label className="text-base font-medium text-slate-800">{t('partnerEdit_cancellationPolicy')}</Label>
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
          <p className="text-xs text-slate-500">{t('partnerEdit_cancellationPolicyHint')}</p>
          <PartnerCancellationPolicyPreview
            policy={formData.cancellationPolicy || 'moderate'}
            language={language}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800">
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
            <Label className="text-base font-medium text-slate-800">
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
              'text-xs leading-relaxed text-slate-600 sm:bg-slate-50',
            )}
          >
            {t('partnerTourMinMaxBackendHint')}
          </p>
        ) : null}
        {!toursWizard ? (
          <PartnerListingDurationDiscountFields
            metadata={formData.metadata}
            language={w.language}
            onChangeDiscount={updateDurationDiscountPercent}
            rentalPeriodDays={transportWizard}
          />
        ) : null}
        <div className="space-y-3">
          <Label className="text-base font-medium text-slate-800">{t('seasonalPricing')}</Label>
          <p className="text-sm leading-relaxed text-slate-500">{t('seasonalPricingDesc')}</p>
          <div className="mt-1 space-y-5">
            <div
              className={cn(
                WIZARD_MOBILE_FLAT_INSET_CLASS,
                'min-w-0 w-full sm:bg-slate-50/90',
              )}
            >
              <Label className="mb-2 block text-sm font-medium text-slate-800">{t('wizardDateRange')}</Label>
              <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <DayPicker
                  mode="range"
                  selected={newSeason.dateRange}
                  onSelect={(range) =>
                    setNewSeason((s) => ({
                      ...s,
                      dateRange: range || { from: null, to: null },
                    }))
                  }
                  locale={dayPickerLocale}
                  className="rdp-root mx-auto !m-0 !p-0 max-w-full [--rdp-day-width:1.85rem] [--rdp-day-height:1.85rem] [--rdp-day_button-width:1.7rem] [--rdp-day_button-height:1.7rem] [--rdp-nav_button-width:1.75rem] [--rdp-nav_button-height:1.75rem] sm:[--rdp-day-width:2.5rem] sm:[--rdp-day-height:2.5rem] sm:[--rdp-day_button-width:2.35rem] sm:[--rdp-day_button-height:2.35rem] [&_.rdp-month_caption]:max-w-full [&_.rdp-month_caption]:truncate [&_.rdp-weekday]:text-[0.6rem] sm:[&_.rdp-weekday]:text-xs [&_.rdp-day]:text-xs sm:[&_.rdp-day]:text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <div className="min-w-0 space-y-1.5">
                <Label className="block text-xs font-medium text-slate-600">{t('seasonLabel')}</Label>
                <Input
                  placeholder={t('seasonLabelExamplePlaceholder')}
                  value={newSeason.label}
                  onChange={(e) => setNewSeason((s) => ({ ...s, label: e.target.value }))}
                  className="h-11 w-full"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="block text-xs font-medium text-slate-600">{t('seasonTypeLabel')}</Label>
                <Select
                  value={newSeason.seasonType}
                  onValueChange={(v) => setNewSeason((s) => ({ ...s, seasonType: v }))}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_TYPES.map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="block text-xs font-medium text-slate-600">
                  {tr('pricePerDayShort', { unit: currencySymbol })}
                </Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="15000"
                  value={newSeason.priceDaily}
                  onChange={(e) => setNewSeason((s) => ({ ...s, priceDaily: sanitizeThbDigits(e.target.value) }))}
                  className="h-11 w-full"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="block text-xs font-medium text-slate-600">
                  {tr('pricePerMonthOptional', { unit: currencySymbol })}
                </Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="—"
                  value={newSeason.priceMonthly}
                  onChange={(e) => setNewSeason((s) => ({ ...s, priceMonthly: sanitizeThbDigits(e.target.value) }))}
                  className="h-11 w-full"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-11 w-full sm:h-10 sm:w-auto"
              onClick={() => {
                const from = newSeason.dateRange?.from
                const to = newSeason.dateRange?.to || newSeason.dateRange?.from
                if (newSeason.label && from && to && newSeason.priceDaily) {
                  setFormData((prev) => ({
                    ...prev,
                    seasonalPricing: [
                      ...(prev.seasonalPricing || []),
                      {
                        id: `s-${Date.now()}`,
                        label: newSeason.label,
                        startDate: format(from, 'yyyy-MM-dd'),
                        endDate: format(to, 'yyyy-MM-dd'),
                        priceDaily: parseFloat(newSeason.priceDaily) || 0,
                        priceMonthly: newSeason.priceMonthly ? parseFloat(newSeason.priceMonthly) : null,
                        seasonType: newSeason.seasonType,
                      },
                    ],
                  }))
                  setNewSeason({
                    label: '',
                    dateRange: { from: null, to: null },
                    priceDaily: '',
                    priceMonthly: '',
                    seasonType: 'NORMAL',
                  })
                  toast.success(t('seasonAddedToast'))
                } else {
                  toast.error(t('seasonFillErrorToast'))
                }
              }}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              {t('addSeason')}
            </Button>
            {(formData.seasonalPricing || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(formData.seasonalPricing || []).map((s, i) => {
                  const colors = getSeasonColor(s.seasonType || 'NORMAL')
                  return (
                    <div
                      key={s.id || i}
                      className={`flex flex-col gap-2 rounded-lg border py-2.5 px-3 sm:flex-row sm:items-center sm:justify-between ${colors.bg} ${colors.border}`}
                    >
                      <span className="text-sm leading-snug tabular-nums">
                        {s.label} ({s.seasonType || 'NORMAL'}): {s.startDate} — {s.endDate} •{' '}
                        {formatInListingBase(s.priceDaily, baseCurrency)}
                        {transportWizard ? t('perBookingDayShort') : t('perNightShort')}
                        {s.priceMonthly
                          ? ` • ${formatInListingBase(s.priceMonthly, baseCurrency)}${t('perMonthShort')}`
                          : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="shrink-0 self-end text-red-600 hover:text-red-700 sm:self-auto"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            seasonalPricing: (prev.seasonalPricing || []).filter((_, j) => j !== i),
                          }))
                        }
                      >
                        {t('removeSeason')}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export const StepPricing = memo(StepPricingInner)
