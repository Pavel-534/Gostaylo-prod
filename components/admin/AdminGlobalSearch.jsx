'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search, User, Ticket, Home, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AdminStatusPill } from '@/components/admin/AdminStatusPill'

const TYPE_META = {
  profile: { icon: User, label: 'Пользователь', chip: 'bg-indigo-50 text-indigo-700' },
  booking: { icon: Ticket, label: 'Бронь', chip: 'bg-amber-50 text-amber-800' },
  listing: { icon: Home, label: 'Объявление', chip: 'bg-emerald-50 text-emerald-800' },
}

/**
 * @param {{ className?: string }} props
 */
export function AdminGlobalSearch({ className }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [mode, setMode] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  const fetchResults = useCallback(async (q) => {
    const trimmed = String(q || '').trim()
    if (trimmed.length < 2) {
      setResults([])
      setMode(null)
      setActiveIdx(0)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setResults([])
        setActiveIdx(0)
        return
      }
      const rows = Array.isArray(json.data?.results) ? json.data.results : []
      setResults(rows)
      setMode(json.data?.mode || null)
      setActiveIdx(0)
    } catch {
      setResults([])
      setActiveIdx(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchResults(query)
    }, 220)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchResults])

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const hint =
    mode === 'email'
      ? 'Email-поиск · точные совпадения выше'
      : mode === 'uuid'
        ? 'UUID · профиль, бронь, объявление'
        : mode === 'booking_prefix'
          ? 'Префикс booking- / book-'
          : mode === 'listing_prefix'
            ? 'Префикс listing- / lst-'
            : 'Enter — перейти к первому результату · ↑↓ — навигация'

  function goTo(row) {
    if (!row?.href) return
    router.push(row.href)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapRef} className={cn('relative w-full max-w-xl', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIdx((i) => Math.max(i - 1, 0))
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              const row = results[activeIdx] || results[0]
              if (row) goTo(row)
            }
          }}
          placeholder="Поиск: @email, UUID, booking-…, listing-…"
          className="pl-9 pr-9 h-10 bg-white/90 border-slate-200/80 shadow-sm rounded-xl focus-visible:ring-brand/30"
          aria-label="Глобальный поиск админки"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] text-slate-500">{hint}</p>
            {results.length > 0 ? (
              <span className="text-[10px] font-medium text-slate-400">{results.length} результат(ов)</span>
            ) : null}
          </div>

          {results.length === 0 && !loading ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Ничего не найдено</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((row, idx) => {
                const meta = TYPE_META[row.type] || TYPE_META.profile
                const Icon = meta.icon
                const active = idx === activeIdx
                const statusLike = ['ACTIVE', 'PENDING', 'PAID', 'REJECTED', 'VERIFIED', 'READY'].includes(
                  String(row.subtitle || '').toUpperCase(),
                )

                return (
                  <li key={`${row.type}-${row.id}`}>
                    <Link
                      href={row.href}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2.5 transition-colors',
                        active ? 'bg-brand/8' : 'hover:bg-slate-50',
                      )}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          meta.chip,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{row.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {meta.label}
                          </span>
                          {statusLike ? <AdminStatusPill status={row.subtitle} className="scale-90 origin-left" /> : null}
                          {row.context ? (
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[220px]">
                              {row.context}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-slate-300 transition-transform',
                          active && 'text-brand translate-x-0.5',
                        )}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
