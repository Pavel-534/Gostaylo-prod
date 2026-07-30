import { Activity, Bike, Briefcase, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeOrderType } from '@/lib/orders/order-timeline'

export default function OrderTypeIcon({ type, className }) {
  const normalized = normalizeOrderType(type)

  if (normalized === 'home') {
    return <Home className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  if (normalized === 'transport') {
    return <Bike className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  if (normalized === 'service') {
    return <Briefcase className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  if (normalized === 'activity') {
    return <Activity className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  return <Home className={cn('h-4 w-4', className)} aria-hidden="true" />
}
