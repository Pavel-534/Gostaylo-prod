'use client'

/**
 * Stage 201.115 — SearchCalendar in a deferred chunk (load on date-field intent).
 * `next/dynamic` alone still fetches when the child mounts; idle shell avoids that
 * until hover/focus/pointer on the dates control (wizardStep mounts eagerly).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const importSearchCalendar = () =>
  import('@/components/search-calendar').then((m) => m.SearchCalendar)

const SearchCalendarDynamic = dynamic(importSearchCalendar, {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4"
      aria-busy="true"
      data-testid="search-calendar-skeleton"
    >
      <div className="h-5 w-5 shrink-0 rounded bg-slate-200 gsl-shimmer" />
      <div className="h-4 w-28 max-w-[55%] rounded bg-slate-200 gsl-shimmer" />
    </div>
  ),
})

export function prefetchSearchCalendarChunk() {
  if (typeof window === 'undefined') return
  void importSearchCalendar()
}

function sameCalendarDay(a, b) {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatIdleDateLabel(value, language, placeholder) {
  const from = value?.from
  if (!from) return placeholder || (language === 'ru' ? 'Даты' : 'Dates')
  const loc = language === 'ru' ? 'ru-RU' : 'en-US'
  const fmt = (d) =>
    d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
  const to = value?.to
  if (!to || sameCalendarDay(from, to)) return `${fmt(from)} — …`
  return `${fmt(from)} — ${fmt(to)}`
}

/**
 * Lightweight stand-in until the calendar chunk mounts (matches trigger chrome).
 */
function SearchCalendarIdleTrigger({
  value,
  locale = 'en',
  placeholder,
  className,
  onActivate,
  onPrefetch,
}) {
  const label = useMemo(
    () => formatIdleDateLabel(value, locale, placeholder),
    [value, locale, placeholder],
  )
  const hasRange = Boolean(value?.from)

  return (
    <button
      type="button"
      data-testid="search-calendar-idle-trigger"
      className={cn(
        'flex w-full min-w-0 items-center gap-3 text-left font-medium transition-colors hover:bg-slate-50/90',
        className,
      )}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onPointerDown={onPrefetch}
      onTouchStart={onPrefetch}
      onClick={onActivate}
    >
      <CalendarIcon className="h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
      <span
        className={cn(
          'truncate text-base font-medium leading-none',
          hasRange ? 'text-slate-900' : 'text-slate-500',
        )}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * @param {import('react').ComponentProps<typeof import('@/components/search-calendar').SearchCalendar>} props
 */
export function SearchCalendarLazy(props) {
  const isWizardStep = props.presentation === 'wizardStep'
  const [active, setActive] = useState(isWizardStep)

  useEffect(() => {
    if (isWizardStep) {
      setActive(true)
      prefetchSearchCalendarChunk()
    }
  }, [isWizardStep])

  const prefetch = useCallback(() => {
    prefetchSearchCalendarChunk()
  }, [])

  const activate = useCallback(() => {
    prefetchSearchCalendarChunk()
    setActive(true)
  }, [])

  if (!active) {
    return (
      <SearchCalendarIdleTrigger
        value={props.value}
        locale={props.locale}
        placeholder={props.placeholder}
        className={props.className}
        onActivate={activate}
        onPrefetch={prefetch}
      />
    )
  }

  return (
    <div
      className="min-w-0"
      onMouseEnter={prefetch}
      onFocusCapture={prefetch}
      onPointerDown={prefetch}
      onTouchStart={prefetch}
    >
      <SearchCalendarDynamic {...props} defaultOpen={!isWizardStep} />
    </div>
  )
}
