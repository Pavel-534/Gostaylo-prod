/**
 * Stage 197.0 / Wave H0 — mobile sticky pay CTA on checkout.
 * Hides when the in-flow `[data-testid=checkout-pay-submit]` is on screen.
 */

'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   language?: string
 *   amountText: string
 *   onPay: () => void
 *   disabled?: boolean
 *   processing?: boolean
 *   className?: string
 * }} props
 */
export function CheckoutStickyPayBar({
  language = 'ru',
  amountText,
  onPay,
  disabled = false,
  processing = false,
  className,
}) {
  const [nativePayVisible, setNativePayVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const target = document.querySelector('[data-testid="checkout-pay-submit"]')
    if (!target) {
      setNativePayVisible(false)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setNativePayVisible(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.35, rootMargin: '0px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [processing, disabled])

  if (nativePayVisible) return null

  const label = getUIText('checkout_payCta', language).replace('{{amount}}', amountText || '—')

  return (
    <div
      className={cn(
        'lg:hidden fixed inset-x-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur',
        'bottom-[var(--app-bottom-nav-height,0px)]',
        'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3',
        className,
      )}
      data-testid="checkout-sticky-pay-bar"
      role="region"
      aria-label={getUIText('checkout_payStickyAria', language)}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {getUIText('checkout_total', language)}
          </p>
          <p className="truncate text-base font-bold tabular-nums text-slate-900">{amountText || '—'}</p>
        </div>
        <Button
          type="button"
          variant="brand"
          disabled={disabled || processing}
          onClick={onPay}
          data-testid="checkout-sticky-pay-submit"
          className="min-h-12 h-12 shrink-0 px-5 text-base font-semibold shadow-md"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {getUIText('checkout_payProcessing', language)}
            </>
          ) : (
            <span className="max-w-[11rem] truncate sm:max-w-none">{label}</span>
          )}
        </Button>
      </div>
    </div>
  )
}
