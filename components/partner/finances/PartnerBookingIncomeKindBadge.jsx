'use client'

import { Home, Car, Briefcase, MapPin } from 'lucide-react'
import { partnerFinancesIncomeDisplayKind } from '@/components/partner/finances/partner-finances-shared'

export function PartnerBookingIncomeKindBadge({ categorySlug, t }) {
  const kind = partnerFinancesIncomeDisplayKind(typeof categorySlug === 'string' ? categorySlug : '')
  const Icon =
    kind === 'stay' ? Home : kind === 'transport' ? Car : kind === 'tour' ? MapPin : Briefcase
  const labelKey =
    kind === 'stay'
      ? 'partnerFinances_incomeTypeStay'
      : kind === 'transport'
        ? 'partnerFinances_incomeTypeTransport'
        : kind === 'tour'
          ? 'partnerFinances_incomeTypeTour'
          : 'partnerFinances_incomeTypeService'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm shrink-0"
      title={t(labelKey)}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="max-w-[4.5rem] truncate sm:max-w-none">{t(labelKey)}</span>
    </span>
  )
}
