'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { getUIText } from '@/lib/translations'

/**
 * Скидки за длительность → listing.metadata.discounts: { weekly, monthly } (%).
 */
export function PartnerListingDurationDiscountFields({ metadata, onChangeDiscount, language = 'ru' }) {
  const t = (key) => getUIText(key, language)
  const d =
    metadata?.discounts && typeof metadata.discounts === 'object' && !Array.isArray(metadata.discounts)
      ? metadata.discounts
      : {}

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <Label className="text-sm font-medium text-slate-800">{t('partnerDurationDiscountsTitle')}</Label>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('partnerDurationDiscountsHint')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">{t('partnerDurationDiscountWeekly')}</Label>
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
          <Label className="text-xs font-medium text-slate-700">{t('partnerDurationDiscountMonthly')}</Label>
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
