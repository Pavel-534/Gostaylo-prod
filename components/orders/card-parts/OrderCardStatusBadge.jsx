'use client'

import { Badge } from '@/components/ui/badge'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

const STATUS_CLASSNAMES = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-800 border-orange-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  PAID: 'bg-blue-100 text-blue-700 border-blue-200',
  PAID_ESCROW: 'bg-teal-100 text-teal-800 border-teal-200',
  CHECKED_IN: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  THAWED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  DECLINED: 'bg-red-100 text-red-700 border-red-200',
  REFUNDED: 'bg-purple-100 text-purple-700 border-purple-200',
}

function fallbackStatusLabel(status) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

export function OrderCardStatusBadge({ status, language = 'ru', className }) {
  const code = String(status || '').trim().toUpperCase()
  const key = `chatBookingStatus_${code}`
  const translated = getUIText(key, language)
  const label = translated !== key ? translated : fallbackStatusLabel(code)
  const tone = STATUS_CLASSNAMES[code] || 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <Badge className={cn('border', tone, className)}>
      {label}
    </Badge>
  )
}

export default OrderCardStatusBadge
