'use client'

import Link from 'next/link'
import { ShieldCheck, Receipt, FileText } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_NESTED_PANEL_CLASS } from '@/lib/ui/mobile-flat-canvas'

/**
 * Stage 200.79 — trust strip above checkout payment methods (escrow / receipt / refund).
 * @param {{ language?: string, className?: string }} props
 */
export function CheckoutTrustBlock({ language = 'ru', className }) {
  const items = [
    {
      key: 'escrow',
      Icon: ShieldCheck,
      text: getUIText('checkout_trustEscrow', language),
    },
    {
      key: 'receipt',
      Icon: Receipt,
      text: getUIText('checkout_trustReceipt', language),
    },
    {
      key: 'refund',
      Icon: FileText,
      text: getUIText('checkout_trustRefund', language),
      href: '/legal/refund/',
      linkLabel: getUIText('checkout_trustRefundLink', language),
    },
  ]

  return (
    <div
      className={cn(
        MOBILE_FLAT_NESTED_PANEL_CLASS,
        'space-y-3 sm:border-emerald-200/80 sm:bg-gradient-to-br sm:from-emerald-50/80 sm:to-white',
        className,
      )}
      data-testid="checkout-trust-block"
    >
      <p className="text-sm font-semibold tracking-tight text-slate-900">
        {getUIText('checkout_trustTitle', language)}
      </p>
      <ul className="space-y-2.5">
        {items.map(({ key, Icon, text, href, linkLabel }) => (
          <li key={key} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 leading-snug">
              {text}
              {href ? (
                <>
                  {' '}
                  <Link
                    href={href}
                    className="font-medium text-brand underline-offset-2 hover:underline"
                    data-testid="checkout-trust-refund-link"
                  >
                    {linkLabel}
                  </Link>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
