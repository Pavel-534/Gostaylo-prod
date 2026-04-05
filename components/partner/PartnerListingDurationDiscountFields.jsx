'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { getUIText } from '@/lib/translations'

/**
 * Скидки за длительность → listing.metadata.discounts: { weekly, monthly } (%).
 * @param {{ rentalPeriodDays?: boolean }} [opts] — для транспорта: подписи «суток» вместо «ночей».
 */
export function PartnerListingDurationDiscountFields({
  metadata,
  onChangeDiscount,
  language = 'ru',
  rentalPeriodDays = false,
}) {
  const t = (key) => getUIText(key, language)
  const d =
    metadata?.discounts && typeof metadata.discounts === 'object' && !Array.isArray(metadata.discounts)
      ? metadata.discounts
      : {}

  const titleKey = rentalPeriodDays ? 'partnerDurationDiscountsTitleVehicle' : 'partnerDurationDiscountsTitle'
  const hintKey = rentalPeriodDays ? 'partnerDurationDiscountsHintVehicle' : 'partnerDurationDiscountsHint'
  const weeklyKey = rentalPeriodDays ? 'partnerDurationDiscountWeeklyVehicle' : 'partnerDurationDiscountWeekly'
  const monthlyKey = rentalPeriodDays ? 'partnerDurationDiscountMonthlyVehicle' : 'partnerDurationDiscountMonthly'

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <Label className="text-sm font-medium text-slate-800">{t(titleKey)}</Label>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(hintKey)}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">{t(weeklyKey)}</Label>
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('partnerDurationDiscountWeeklyPh')}
            value={d.weekly != null && d.weekly !== '' ? String(d.weekly) : ''}
            onChange={(e) => onChangeDiscount('weekly', e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">{t(monthlyKey)}</Label>
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('partnerDurationDiscountMonthlyPh')}
            value={d.monthly != null && d.monthly !== '' ? String(d.monthly) : ''}
            onChange={(e) => onChangeDiscount('monthly', e.target.value)}
            className="h-11"
          />
        </div>
      </div>
    </div>
  )
}
