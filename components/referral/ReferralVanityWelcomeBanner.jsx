'use client'

import { useEffect, useMemo, useState } from 'react'
import { Gift, Heart, Sparkles } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { getUIText } from '@/lib/translations'
import {
  persistVanityWelcomeSession,
  readVanityWelcomeSession,
} from '@/lib/referral/vanity-welcome-session'

/**
 * Stage 131.4 / 143 — warm welcome after `/go/{vanity}` (landing, home, catalog, PDP).
 */
export function ReferralVanityWelcomeBanner({
  ambassadorName: ambassadorNameProp,
  welcomeBonusThb: welcomeBonusProp = 500,
  className = '',
  persistSession = true,
  language = 'ru',
}) {
  const searchParams = useSearchParams()
  const vanityFromUrl = searchParams?.get('vanity')
  const welcomeFromUrl = searchParams?.get('welcome') === '1'
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  const [resolved, setResolved] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const session = readVanityWelcomeSession()
      const vanity = String(vanityFromUrl || session?.vanity || '')
        .trim()
        .toLowerCase()

      if (!vanity && !welcomeFromUrl) {
        if (!cancelled) setResolved(null)
        return
      }

      if (ambassadorNameProp && vanityFromUrl && welcomeFromUrl) {
        const payload = {
          vanity,
          ambassadorName: ambassadorNameProp,
          welcomeBonusThb: welcomeBonusProp,
        }
        if (persistSession) persistVanityWelcomeSession(payload)
        if (!cancelled) setResolved(payload)
        return
      }

      if (session?.vanity && session?.ambassadorName && !vanityFromUrl) {
        if (!cancelled) setResolved(session)
        return
      }

      if (!vanity) return

      try {
        const res = await fetch(
          `/api/v2/referral/vanity-welcome?${new URLSearchParams({ vanity })}`,
          { cache: 'no-store' },
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.success) {
          if (!cancelled) setResolved(null)
          return
        }
        const payload = {
          vanity: json.data.vanity,
          ambassadorName: json.data.ambassadorName,
          welcomeBonusThb: json.data.welcomeBonusThb ?? 500,
        }
        if (persistSession) persistVanityWelcomeSession(payload)
        if (!cancelled) setResolved(payload)
      } catch {
        if (!cancelled) setResolved(null)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [vanityFromUrl, welcomeFromUrl, ambassadorNameProp, welcomeBonusProp, persistSession])

  if (!resolved?.vanity) return null

  const name = String(resolved.ambassadorName || t('stage143_vanityAmbassadorFallback')).trim()

  return (
    <div
      className={`rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-white to-teal-50/90 px-5 py-4 shadow-sm ${className}`}
      role="status"
    >
      <div className="flex gap-4 items-start">
        <div className="rounded-xl bg-white/90 border border-brand/15 p-2.5 shrink-0 shadow-sm">
          <Gift className="h-6 w-6 text-brand" aria-hidden />
        </div>
        <div className="space-y-2 text-slate-700 min-w-0">
          <p className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
            <Sparkles className="inline h-4 w-4 text-brand mr-1.5 -mt-0.5" aria-hidden />
            {t('stage143_vanityWelcomeTitle', { name })}
          </p>
          <p className="text-sm leading-relaxed">{t('stage143_vanityWelcomeBody')}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" aria-hidden />
            {t('stage143_vanityWelcomeFoot')}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Compact strip for homepage / catalog top. */
export function ReferralVanityWelcomeHost({ className = '', language = 'ru' }) {
  return (
    <div className={`mx-auto max-w-4xl px-4 pt-4 ${className}`}>
      <ReferralVanityWelcomeBanner persistSession language={language} />
    </div>
  )
}
