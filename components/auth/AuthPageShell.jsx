'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSiteDisplayName } from '@/lib/site-url'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 189.0 — fullscreen auth shell (no AppHeader / BottomNav).
 */
export function AuthPageShell({ children, title, subtitle, backHref = '/', className }) {
  const { language } = useI18n()
  const brand = getSiteDisplayName()

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-900 antialiased',
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <Link
          href={backHref}
          className="mt-0.5 inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label={getUIText('auth_backToHome', language)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{brand}</p>
          {title ? (
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm leading-snug text-slate-500">{subtitle}</p> : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
    </div>
  )
}

export default AuthPageShell
