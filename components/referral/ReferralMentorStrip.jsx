'use client'

import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { resolveAvatarDisplaySrc } from '@/lib/image-display-url'
import { useMemo } from 'react'

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

/**
 * Stage 132.2 — persistent upline visibility on `/profile/referral`.
 *
 * @param {{ referredBy?: { id: string, displayName: string, avatarUrl?: string | null, tierLabel?: string | null, landingUrl?: string } | null, brandName?: string, className?: string }} props
 */
export function ReferralMentorStrip({ referredBy = null, brandName = '', className = '' }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  if (!referredBy?.id || !referredBy?.displayName) return null

  const brand = String(brandName || '').trim() || 'Platform'
  const label = String(t('stage1322_mentorLabel')).replace(/\{brand\}/g, brand)
  const avatarSrc = resolveAvatarDisplaySrc(referredBy.avatarUrl)
  const profileHref = referredBy.landingUrl || `/u/${encodeURIComponent(referredBy.id)}`

  return (
    <div
      className={`mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar className="h-10 w-10 shrink-0 border border-brand/20">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" className="object-cover" /> : null}
          <AvatarFallback className="bg-brand/10 text-brand text-sm font-semibold">
            {initialsFromName(referredBy.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{referredBy.displayName}</p>
          {referredBy.tierLabel ? (
            <p className="text-xs text-slate-500 truncate">{referredBy.tierLabel}</p>
          ) : null}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 w-full sm:w-auto">
        <Link href={profileHref}>
          <UserRound className="h-4 w-4 mr-1.5" aria-hidden />
          {t('stage1322_mentorProfile')}
        </Link>
      </Button>
    </div>
  )
}
