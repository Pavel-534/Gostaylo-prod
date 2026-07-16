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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PartnerListingDurationDiscountFields } from '@/components/partner/PartnerListingDurationDiscountFields'
import { PartnerCancellationPolicyPreview } from '@/components/partner/wizard/PartnerCancellationPolicyPreview'
import { WizardPartnerEarningsCalculator } from '@/components/partner/wizard/WizardPartnerEarningsCalculator'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'
import { useListingWizard } from '../context/ListingWizardContext'
import { clampIntFromDigits, sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import { cn } from '@/lib/utils'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'

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
  } = w
  const baseCurrency = String(formData.baseCurrency || 'THB').toUpperCase()
  const { formatInListingBase } = useStorefrontDisplayFx()

  const periodLabel = useMemo(() => {
    if (transportWizard) return t('wizardPriceCalcPeriodBookingDay')
    if (toursWizard) return t('wizardPriceCalcPeriodTour')
    return t('wizardPriceCalcPeriodNight')
  }, [transportWizard, toursWizard, t])

  return (
    <TooltipProvider>
      <div className={cn(WIZARD_STEP_ROOT_CLASS, 'space-y-8')}>
        <div className="space-y-2">
          <h2 className={WIZARD_STEP_TITLE_CLASS}>{t('pricingAndBooking')}</h2>
          <p className={`leading-relaxed ${WIZARD_STEP_SUBTITLE_CLASS}`}>{t('setRates')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label className="text-base font-medium text-slate-800">
              {transportWizard ? t('basePriceVehicle') : toursWizard ? t('basePriceTour') : t('basePrice')}{' '}
              <span className="text-xs font-normal text-slate-500">({baseCurrency})</span>
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder={toursWizard ? t('basePriceTourPlaceholder') : t('basePricePlaceholder')}
              value={formData.basePriceThb}
              onChange={(e) => updateField('basePriceThb', sanitizeThbDigits(e.target.value))}
              className="mt-2 h-12"
            />
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
                className={cn('mt-2 h-12', baseCurrencyLocked && 'cursor-not-allowed opacity-60')}
                aria-disabled={baseCurrencyLocked}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB (Thai Baht)</SelectItem>
                <SelectItem value="RUB">RUB (Russian Ruble)</SelectItem>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="USDT">USDT (Tether)</SelectItem>
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
            <SelectTrigger className="h-12 w-full max-w-md">
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
              className="mt-2 h-12"
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
              className="mt-2 h-12"
            />
          </div>
        </div>
        {toursWizard ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
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
            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4">
              <Label className="mb-2 block text-sm font-medium text-slate-800">{t('wizardDateRange')}</Label>
              <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
                <div className="inline-flex min-w-full justify-center px-0.5 pb-1 sm:px-0">
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
                    className="rdp-root !p-0 [--rdp-day-width:2.25rem] [--rdp-day-height:2.25rem] [--rdp-day_button-width:2.125rem] [--rdp-day_button-height:2.125rem] sm:[--rdp-day-width:2.75rem] sm:[--rdp-day-height:2.75rem] sm:[--rdp-day_button-width:2.625rem] sm:[--rdp-day_button-height:2.625rem] [&_.rdp-weekday]:text-[0.65rem] sm:[&_.rdp-weekday]:text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">{t('seasonLabel')}</Label>
                <Input
                  placeholder={t('seasonLabelExamplePlaceholder')}
                  value={newSeason.label}
                  onChange={(e) => setNewSeason((s) => ({ ...s, label: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">{t('seasonTypeLabel')}</Label>
                <Select
                  value={newSeason.seasonType}
                  onValueChange={(v) => setNewSeason((s) => ({ ...s, seasonType: v }))}
                >
                  <SelectTrigger className="h-11">
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
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {t('pricePerDayShort')} ({baseCurrency})
                </Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="15000"
                  value={newSeason.priceDaily}
                  onChange={(e) => setNewSeason((s) => ({ ...s, priceDaily: sanitizeThbDigits(e.target.value) }))}
                  className="h-11"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {t('pricePerMonthOptional')} ({baseCurrency})
                </Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="—"
                  value={newSeason.priceMonthly}
                  onChange={(e) => setNewSeason((s) => ({ ...s, priceMonthly: sanitizeThbDigits(e.target.value) }))}
                  className="h-11"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-10"
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
