'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSiteDisplayName } from '@/lib/site-url'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 189.0 / 189.3.1 — fullscreen Immersive Auth shell (no AppHeader / BottomNav).
 * Premium brand gradient + elevated form card (`rounded-3xl`).
 */
export function AuthPageShell({ children, title, subtitle, backHref = '/', className }) {
  const { language } = useI18n()
  const brand = getSiteDisplayName()

  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-tr from-slate-50 via-slate-50 to-brand/10 font-sans text-slate-900 antialiased',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-navy/5 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 flex shrink-0 items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <Link
          href={backHref}
          className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
          aria-label={getUIText('auth_backToHome', language)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="mb-6 mt-1 text-center">
          <p className="text-3xl font-semibold tracking-tight text-brand sm:text-4xl">{brand}</p>
          {title ? (
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-brand/5 backdrop-blur-sm sm:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AuthPageShell
