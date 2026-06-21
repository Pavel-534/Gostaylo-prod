import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** SSOT tones for partner listing lifecycle — Mint/Navy theme tokens only. */
export const PARTNER_LISTING_STATUS_TONE_CLASS = {
  draft: 'border-dashed border-slate-300 bg-slate-50 text-slate-600',
  active: 'border-brand/25 bg-brand/10 text-brand',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  inactive: 'border-slate-200 bg-slate-100 text-slate-700',
  hidden: 'border-slate-300 bg-slate-200/80 text-slate-800',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  booked: 'border-brand-navy/20 bg-brand-navy/5 text-brand-navy',
}

/**
 * @param {'draft'|'active'|'pending'|'inactive'|'hidden'|'rejected'|'booked'} tone
 */
export function PartnerListingStatusBadge({ tone, children, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        PARTNER_LISTING_STATUS_TONE_CLASS[tone] || PARTNER_LISTING_STATUS_TONE_CLASS.inactive,
        className,
      )}
    >
      {children}
    </Badge>
  )
}

/** Map list-card effective status → badge tone. */
export function partnerListingStatusToTone(status) {
  switch (status) {
    case 'ACTIVE':
      return 'active'
    case 'PENDING':
      return 'pending'
    case 'HIDDEN':
      return 'hidden'
    case 'REJECTED':
      return 'rejected'
    case 'BOOKED':
      return 'booked'
    case 'INACTIVE':
    default:
      return 'draft'
  }
}

/** Wizard header badge tone from server listing + draft flag. */
export function partnerWizardListingStatusTone({ isDraft, status }) {
  if (isDraft) return 'draft'
  if (status === 'ACTIVE') return 'active'
  if (status === 'PENDING') return 'pending'
  return 'inactive'
}
