/**
 * Wave H1 — floating unpaid checkout hold banner (guest surfaces).
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UrgencyTimer } from '@/components/UrgencyTimer'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { applyCheckoutI18nSlice } from '@/lib/translations/register-checkout-i18n'
import { cn } from '@/lib/utils'

function dismissKey(bookingId) {
  return bookingId ? `unpaid_checkout_banner_dismissed_${bookingId}` : null
}

/**
 * @param {{ className?: string }} [props]
 */
export function UnpaidCheckoutNudgeBanner({ className }) {
  const pathname = usePathname() || ''
  const { user, loading: authLoading } = useAuth()
  const { language } = useI18n()
  const [payload, setPayload] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    applyCheckoutI18nSlice()
  }, [])

  const hideOnCheckout = pathname.startsWith('/checkout')
  const hideOnPartner = pathname.startsWith('/partner')
  const hideOnAdmin = pathname.startsWith('/admin')
  const hideOnAuth = pathname.startsWith('/auth')

  const load = useCallback(async () => {
    if (!user?.id) {
      setPayload(null)
      return
    }
    try {
      const res = await fetch('/api/v2/me/unpaid-checkout-hold', { credentials: 'include' })
      if (!res.ok) {
        setPayload(null)
        return
      }
      const json = await res.json()
      const data = json?.data || null
      if (!data?.bookingId || !data?.expiresAt) {
        setPayload(null)
        return
      }
      const key = dismissKey(data.bookingId)
      try {
        if (key && typeof window !== 'undefined' && localStorage.getItem(key) === '1') {
          setDismissed(true)
        } else {
          setDismissed(false)
        }
      } catch {
        setDismissed(false)
      }
      setPayload(data)
    } catch {
      setPayload(null)
    }
  }, [user?.id])

  useEffect(() => {
    if (authLoading || hideOnCheckout || hideOnPartner || hideOnAdmin || hideOnAuth) return
    void load()
    const t = setInterval(() => void load(), 60_000)
    return () => clearInterval(t)
  }, [authLoading, hideOnCheckout, hideOnPartner, hideOnAdmin, hideOnAuth, load])

  if (
    authLoading ||
    !user?.id ||
    hideOnCheckout ||
    hideOnPartner ||
    hideOnAdmin ||
    hideOnAuth ||
    !payload ||
    dismissed
  ) {
    return null
  }

  const title = getUIText('unpaidCheckoutBanner_title', language, {
    listing: payload.listingTitle || getUIText('unpaidCheckoutBanner_listingFallback', language),
  })

  function onDismiss() {
    setDismissed(true)
    const key = dismissKey(payload.bookingId)
    if (!key) return
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3',
        'bottom-[calc(var(--app-bottom-nav-height,0px)+0.75rem+env(safe-area-inset-bottom,0px))]',
        'md:bottom-6',
        className,
      )}
      data-testid="unpaid-checkout-nudge-banner"
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-amber-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-3 sm:p-3.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Clock className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold leading-snug text-slate-900">{title}</p>
            <UrgencyTimer
              endsAt={payload.expiresAt}
              language={language}
              variant="compact"
              prefixKey="checkout_holdCountdownPrefix"
              endedKey="checkout_holdEnded"
              className="!border-0 !bg-transparent !p-0 !shadow-none"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
          <Button asChild variant="brand" className="min-h-11 flex-1 font-semibold sm:min-w-[7.5rem]">
            <Link href={payload.checkoutPath} data-testid="unpaid-checkout-nudge-pay">
              {getUIText('unpaidCheckoutBanner_pay', language)}
            </Link>
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label={getUIText('unpaidCheckoutBanner_dismiss', language)}
          >
            {getUIText('unpaidCheckoutBanner_dismiss', language)}
          </button>
        </div>
      </div>
    </div>
  )
}
