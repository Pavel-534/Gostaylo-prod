'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSiteDisplayName } from '@/lib/site-url'

/**
 * Stage 202.33 — collapsible compliance footnotes (earnings tab).
 *
 * @param {{
 *   t: (key: string, ctx?: object) => string,
 *   monthlyInviteLimit?: number | null,
 *   brandName?: string,
 *   className?: string,
 * }} props
 */
export function ReferralLegalFootnotes({ t, monthlyInviteLimit, brandName, className }) {
  const [open, setOpen] = useState(false)
  const brand = String(brandName || '').trim() || getSiteDisplayName()
  const limit = Number(monthlyInviteLimit)
  const limitText = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30

  return (
    <section
      className={cn('rounded-2xl border border-slate-200/80 bg-slate-50/60', className)}
      data-testid="referral-legal-footnotes"
    >
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t('referralLegalFootnotes_title')}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-slate-200/80 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
          <li data-testid="referral-disclaimer-invite-limit">
            {t('referralInviteLimit', { limit: String(limitText) })}
          </li>
          <li data-testid="referral-disclaimer-tax">
            {t('taxResponsibility')}{' '}
            <Link href="/terms/" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800">
              {t('taxResponsibility_link')}
            </Link>
          </li>
          <li data-testid="referral-disclaimer-no-agency">{t('noAgencyRelationship', { brand })}</li>
        </ul>
      ) : (
        <p className="sr-only">{t('referralLegalFootnotes_toggle')}</p>
      )}
    </section>
  )
}

export default ReferralLegalFootnotes
