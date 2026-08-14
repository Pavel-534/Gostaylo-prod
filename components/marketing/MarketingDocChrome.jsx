'use client'

/**
 * Stage 201.31 — единый визуальный chrome для About / Terms / Help / Legal.
 * SSOT оформления (не юридического текста): eyebrow pill, H1, lead, отступы.
 */

import { cn } from '@/lib/utils'

export const MARKETING_DOC_EYEBROW_CLASS =
  'mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-hover'

export const MARKETING_DOC_H1_CLASS =
  'text-4xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl'

export const MARKETING_DOC_LEAD_CLASS =
  'mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg'

/**
 * @param {object} props
 * @param {React.ReactNode} [props.eyebrow]
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.lead]
 * @param {React.ReactNode} [props.meta]
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.banner]
 * @param {React.ReactNode} [props.children]
 * @param {string} [props.className]
 * @param {string} [props.contentClassName] — max-width контейнера тела (default max-w-3xl)
 * @param {boolean} [props.unwrapped] — children after hero without default container (About/Terms/Help)
 * @param {boolean} [props.heroBorder=true]
 */
export function MarketingDocChrome({
  eyebrow,
  title,
  lead,
  meta,
  actions,
  banner,
  children,
  className,
  contentClassName,
  unwrapped = false,
  heroBorder = true,
}) {
  return (
    <main className={cn('min-h-screen bg-white font-sans antialiased text-slate-900', className)}>
      <section
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-brand/10 via-white to-white',
          heroBorder && 'border-b border-slate-100',
        )}
      >
        <div className="container mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
          {eyebrow ? <p className={MARKETING_DOC_EYEBROW_CLASS}>{eyebrow}</p> : null}
          <h1 className={MARKETING_DOC_H1_CLASS}>{title}</h1>
          {lead ? <p className={MARKETING_DOC_LEAD_CLASS}>{lead}</p> : null}
          {meta ? (
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{meta}</p>
          ) : null}
          {banner ? <div className="mt-6">{banner}</div> : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </section>

      {children == null ? null : unwrapped ? (
        children
      ) : (
        <div
          className={cn(
            'container mx-auto px-4 py-10 sm:px-6 sm:py-12',
            contentClassName ?? 'max-w-3xl',
          )}
        >
          {children}
        </div>
      )}
    </main>
  )
}
