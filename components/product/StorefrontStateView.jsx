/**
 * Stage 199.3 / 199.4 — unified storefront empty / error / denied / success surface (Golden Loop).
 */

'use client'

import Link from 'next/link'
import { AlertCircle, CheckCircle2, Inbox, Lock, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { GSL_BRAND_SHADOW_ICON, GSL_BRAND_SHADOW_RING, GSL_CARD } from '@/lib/theme/product-ui'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const ICONS = {
  empty: Search,
  error: AlertCircle,
  denied: Lock,
  inbox: Inbox,
  success: CheckCircle2,
}

/**
 * @param {{
 *   variant?: 'empty' | 'error' | 'denied' | 'inbox' | 'success'
 *   title: string
 *   body?: string
 *   primaryLabel?: string
 *   primaryHref?: string
 *   onPrimaryClick?: () => void
 *   secondaryLabel?: string
 *   secondaryHref?: string
 *   onSecondaryClick?: () => void
 *   tertiaryLabel?: string
 *   tertiaryHref?: string
 *   onTertiaryClick?: () => void
 *   className?: string
 *   testId?: string
 *   children?: React.ReactNode
 * }} props
 */
export function StorefrontStateView({
  variant = 'empty',
  title,
  body,
  primaryLabel,
  primaryHref,
  onPrimaryClick,
  secondaryLabel,
  secondaryHref,
  onSecondaryClick,
  tertiaryLabel,
  tertiaryHref,
  onTertiaryClick,
  className,
  testId = 'storefront-state-view',
  children,
}) {
  const Icon = ICONS[variant] || Search
  const iconTone =
    variant === 'error'
      ? 'from-amber-500 to-amber-600'
      : variant === 'denied'
        ? 'from-slate-600 to-slate-800'
        : variant === 'success'
          ? 'from-emerald-500 to-emerald-600'
          : 'from-brand to-brand-hover'

  function renderCta({
    label,
    href,
    onClick,
    tone,
    testSuffix,
  }) {
    if (!label || (!onClick && !href)) return null
    const classNameByTone =
      tone === 'brand'
        ? 'min-h-[44px] w-full font-semibold'
        : tone === 'outline'
          ? 'min-h-[44px] w-full'
          : 'min-h-[44px] w-full text-slate-600'
    const variantName = tone === 'brand' ? 'brand' : tone === 'outline' ? 'outline' : 'ghost'
    const tid = `${testId}-${testSuffix}`

    if (href && onClick) {
      return (
        <Button asChild variant={variantName} className={classNameByTone} data-testid={tid}>
          <Link href={href} onClick={onClick}>
            {label}
          </Link>
        </Button>
      )
    }
    if (onClick && !href) {
      return (
        <Button
          type="button"
          variant={variantName}
          className={classNameByTone}
          onClick={onClick}
          data-testid={tid}
        >
          {label}
        </Button>
      )
    }
    return (
      <Button asChild variant={variantName} className={classNameByTone} data-testid={tid}>
        <Link href={href}>{label}</Link>
      </Button>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[40vh] items-center justify-center px-4 py-12 sm:py-16',
        className,
      )}
      data-testid={testId}
      data-variant={variant}
      role="status"
    >
      <Card className={cn(GSL_CARD, MOBILE_FLAT_CARD_CLASS, 'w-full max-w-md')}>
        <CardContent
          className={cn(
            MOBILE_FLAT_CARD_CONTENT_CLASS,
            'flex flex-col items-center text-center max-sm:py-6 sm:px-8 sm:py-8 sm:pt-8',
          )}
        >
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center" aria-hidden>
            <div className={cn('absolute inset-0 rounded-full bg-white', GSL_BRAND_SHADOW_RING)} />
            <div
              className={cn(
                'relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-white',
                iconTone,
                GSL_BRAND_SHADOW_ICON,
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={2.25} />
            </div>
          </div>

          <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h2>
          {body ? (
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-600 sm:text-base">{body}</p>
          ) : (
            <div className="mb-6" />
          )}

          {children ? <div className="mb-6 w-full text-left">{children}</div> : null}

          <div className="flex w-full flex-col gap-2.5">
            {renderCta({
              label: primaryLabel,
              href: primaryHref,
              onClick: onPrimaryClick,
              tone: 'brand',
              testSuffix: 'primary',
            })}
            {renderCta({
              label: secondaryLabel,
              href: secondaryHref,
              onClick: onSecondaryClick,
              tone: 'outline',
              testSuffix: 'secondary',
            })}
            {renderCta({
              label: tertiaryLabel,
              href: tertiaryHref,
              onClick: onTertiaryClick,
              tone: 'ghost',
              testSuffix: 'tertiary',
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
