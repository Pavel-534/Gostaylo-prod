'use client'

/**
 * PartnerCTA — секция привлечения хостов/партнёров.
 * Дизайн: bg-slate-900 (тёмный), белый текст, brand-акценты.
 * Размещается перед футером на главной странице.
 * Stage 202.8 — CTA → заявка на `/renter/profile`, не в guarded `/partner/dashboard`
 * (иначе гость/RENTER «ничего не происходит»: middleware → login или bounce на `/`).
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Building2, Car, Anchor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText, getCategoryName } from '@/lib/translations'
import { useAuth } from '@/contexts/auth-context'
import {
  PARTNER_CABINET_HREF,
  PARTNER_ONBOARDING_HREF,
  isPartnerCabinetRole,
} from '@/lib/navigation/partner-onboarding-href'

const CATEGORY_PILLS = [
  { icon: Building2, slug: 'property' },
  { icon: Car, slug: 'vehicles' },
  { icon: Anchor, slug: 'yachts' },
]

export function PartnerCTA({ language = 'ru' }) {
  const router = useRouter()
  const { user, openLoginModal, refreshUserFromServer } = useAuth()
  const [busy, setBusy] = useState(false)

  const handleBecomePartner = useCallback(
    async (e) => {
      e.preventDefault()
      if (busy) return
      setBusy(true)
      try {
        const refreshed = await refreshUserFromServer?.()
        // null = logged out; undefined = transient — fall back to in-memory user
        const sessionUser = refreshed === undefined ? user : refreshed
        if (!sessionUser) {
          openLoginModal?.({ redirect: PARTNER_ONBOARDING_HREF })
          return
        }
        if (isPartnerCabinetRole(sessionUser.role)) {
          if (typeof window !== 'undefined') {
            window.location.assign(PARTNER_CABINET_HREF)
            return
          }
          router.push(PARTNER_CABINET_HREF)
          return
        }
        router.push(PARTNER_ONBOARDING_HREF)
      } catch {
        openLoginModal?.({ redirect: PARTNER_ONBOARDING_HREF })
      } finally {
        setBusy(false)
      }
    },
    [busy, openLoginModal, refreshUserFromServer, router, user],
  )

  return (
    <section className="bg-slate-900">
      <div className="container mx-auto px-6 py-12 sm:py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:items-center sm:gap-16 sm:text-left">
          <div className="flex-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand/70">
              {getUIText('partnerCtaEyebrow', language)}
            </p>

            <h2 className="font-serif mb-4 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-white sm:text-[38px]">
              {getUIText('partnerCtaTitle', language)}
            </h2>

            <p className="max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
              {getUIText('partnerCtaDesc', language)}
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
              {CATEGORY_PILLS.map(({ icon: Icon, slug }) => (
                <span
                  key={slug}
                  className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300"
                >
                  <Icon className="h-3.5 w-3.5 text-brand/70" />
                  {getCategoryName(slug, language)}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <Button
              asChild
              variant="brand"
              size="lg"
              disabled={busy}
              className="rounded-2xl px-8 py-6 text-base font-bold shadow-[0_12px_32px_rgba(0,102,102,0.35)] hover:shadow-[0_16px_40px_rgba(0,102,102,0.45)]"
            >
              <Link
                href={PARTNER_ONBOARDING_HREF}
                className="group inline-flex items-center gap-3"
                onClick={handleBecomePartner}
                data-testid="home-partner-cta"
              >
                {getUIText('partnerCtaBtn', language)}
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {getUIText('partnerCtaFree', language)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
