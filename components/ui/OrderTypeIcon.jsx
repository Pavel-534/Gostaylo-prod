import { Activity, Bike, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

function normalizeType(type) {
  return String(type || '').trim().toLowerCase()
}

export default function OrderTypeIcon({ type, className }) {
  const normalized = normalizeType(type)

  if (normalized === 'home') {
    return <Home className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  if (normalized === 'transport') {
    return <Bike className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  if (normalized === 'activity' || normalized === 'tour' || normalized === 'tours') {
    return <Activity className={cn('h-4 w-4', className)} aria-hidden="true" />
  }

  return <Activity className={cn('h-4 w-4', className)} aria-hidden="true" />
}
