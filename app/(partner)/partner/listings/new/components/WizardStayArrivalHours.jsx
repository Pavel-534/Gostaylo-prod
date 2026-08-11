'use client'

/**
 * Stage 200.99 — stay vertical: check-in / check-out times + soft “on request” flexibility.
 * Does not touch calendar, pricing, or ledger.
 */

import { Clock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ARRIVAL_TIME_SLOTS,
  normalizeArrivalTime,
} from '@/lib/listing/stay-arrival-hours'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { WIZARD_MOBILE_FLAT_INSET_CLASS } from './wizard-step-layout'

function ArrivalTimeField({ id, label, value, onChange, unsetLabel, className }) {
  const normalized = normalizeArrivalTime(value)
  const selectValue = normalized || '__unset__'
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <Label htmlFor={id} className={PARTNER_FIELD_LABEL_CLASS}>
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === '__unset__' ? '' : v)}
      >
        <SelectTrigger
          id={id}
          className="h-12 min-h-[44px] w-full"
          data-testid={id}
        >
          <SelectValue placeholder={unsetLabel} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__unset__">{unsetLabel}</SelectItem>
          {ARRIVAL_TIME_SLOTS.map((slot) => (
            <SelectItem key={slot} value={slot}>
              {slot}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * @param {{
 *   t: (key: string) => string,
 *   checkInTime: string,
 *   checkOutTime: string,
 *   earlyCheckInOnRequest: boolean,
 *   lateCheckOutOnRequest: boolean,
 *   onCheckInTime: (v: string) => void,
 *   onCheckOutTime: (v: string) => void,
 *   onEarlyCheckIn: (v: boolean) => void,
 *   onLateCheckOut: (v: boolean) => void,
 * }} props
 */
export function WizardStayArrivalHours({
  t,
  checkInTime,
  checkOutTime,
  earlyCheckInOnRequest,
  lateCheckOutOnRequest,
  onCheckInTime,
  onCheckOutTime,
  onEarlyCheckIn,
  onLateCheckOut,
}) {
  return (
    <section
      className="space-y-4"
      data-partner-section="basics-arrival-hours"
      data-testid="wizard-stay-arrival-hours"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <Clock className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardArrival_sectionTitle')}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{t('wizardArrival_sectionHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <ArrivalTimeField
          id="wizard-check-in-time"
          label={t('wizardArrival_checkInLabel')}
          value={checkInTime}
          onChange={onCheckInTime}
          unsetLabel={t('wizardArrival_notSet')}
        />
        <ArrivalTimeField
          id="wizard-check-out-time"
          label={t('wizardArrival_checkOutLabel')}
          value={checkOutTime}
          onChange={onCheckOutTime}
          unsetLabel={t('wizardArrival_notSet')}
        />
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{t('wizardArrival_timesHint')}</p>

      <div
        className={cn(
          WIZARD_MOBILE_FLAT_INSET_CLASS,
          'space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:bg-slate-50/80',
        )}
      >
        <p className="text-sm font-medium text-slate-800">{t('wizardArrival_flexTitle')}</p>
        <p className="text-xs leading-relaxed text-slate-600">{t('wizardArrival_flexHint')}</p>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label htmlFor="wizard-early-check-in" className={PARTNER_FIELD_LABEL_CLASS}>
              {t('wizardArrival_earlyOnRequest')}
            </Label>
            <p className="text-xs text-slate-500">{t('wizardArrival_earlyOnRequestHint')}</p>
          </div>
          <Switch
            id="wizard-early-check-in"
            checked={earlyCheckInOnRequest === true}
            onCheckedChange={(v) => onEarlyCheckIn(v === true)}
            className="mt-1 shrink-0 data-[state=checked]:bg-brand"
            data-testid="wizard-early-check-in"
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-slate-200/80 pt-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label htmlFor="wizard-late-check-out" className={PARTNER_FIELD_LABEL_CLASS}>
              {t('wizardArrival_lateOnRequest')}
            </Label>
            <p className="text-xs text-slate-500">{t('wizardArrival_lateOnRequestHint')}</p>
          </div>
          <Switch
            id="wizard-late-check-out"
            checked={lateCheckOutOnRequest === true}
            onCheckedChange={(v) => onLateCheckOut(v === true)}
            className="mt-1 shrink-0 data-[state=checked]:bg-brand"
            data-testid="wizard-late-check-out"
          />
        </div>
      </div>
    </section>
  )
}
