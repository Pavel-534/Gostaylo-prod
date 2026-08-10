'use client'

/**
 * Stage 200.83 — street / address typeahead (suggest → pin), Airbnb-like.
 * City field stays cascade-only; picking a street result places the listing pin.
 */

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

function isStreetLike(r) {
  const level = String(r.level || r.type || '').toLowerCase()
  if (['country', 'region', 'state', 'city', 'town', 'municipality'].includes(level)) {
    return false
  }
  if (['house', 'building', 'street', 'road', 'residential', 'address', 'amenity'].includes(level)) {
    return true
  }
  // Nominatim often returns road/suburb without clean level — keep if it has coords + display
  return Boolean(r.lat != null && r.lon != null && (r.displayName || r.labelEn || r.labelRu))
}

function resultPrimary(r) {
  return r.displayName || r.labelRu || r.labelEn || ''
}

/**
 * @param {{
 *   countryCode?: string|null
 *   cityLabel?: string|null
 *   value: string
 *   disabled?: boolean
 *   hasError?: boolean
 *   placeholder?: string
 *   className?: string
 *   t: (key: string) => string
 *   onChangeText: (value: string) => void
 *   onSelectResult: (result: object) => void | Promise<void>
 * }} props
 */
export function WizardStreetTypeahead({
  countryCode,
  cityLabel,
  value,
  disabled = false,
  hasError = false,
  placeholder,
  className,
  t,
  onChangeText,
  onSelectResult,
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const runSearch = async (q) => {
    const needle = String(q || '').trim()
    if (!countryCode || needle.length < 3) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const city = String(cityLabel || '').trim()
      const composed =
        city && !needle.toLowerCase().includes(city.toLowerCase())
          ? `${needle}, ${city}`
          : needle
      const res = await fetch(
        `/api/v2/geocode/suggest?q=${encodeURIComponent(composed)}&country=${encodeURIComponent(countryCode)}`,
        { cache: 'no-store' },
      )
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success && Array.isArray(json.data)) {
        const streetFirst = json.data.filter(isStreetLike)
        const rest = json.data.filter((r) => !isStreetLike(r))
        setResults([...streetFirst, ...rest].slice(0, 8))
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const onChange = (next) => {
    onChangeText(next)
    setOpen(true)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(next), 300)
  }

  const pick = async (r) => {
    setOpen(false)
    setResults([])
    await onSelectResult(r)
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          className={cn(
            'h-11 w-full pr-10',
            hasError && 'border-red-400 focus-visible:ring-red-400',
          )}
          value={value || ''}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="street-address"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (String(value || '').trim().length >= 3) {
              setOpen(true)
              void runSearch(value)
            }
          }}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault()
              void pick(results[activeIndex])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : (
          <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
      </div>
      {open && results.length > 0 ? (
        <div
          className="absolute z-30 mt-1 max-h-56 w-full divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {results.map((r, i) => {
            const primary = resultPrimary(r)
            return (
              <button
                key={`${r.code || ''}-${r.lat}-${r.lon}-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  'min-h-[44px] w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50',
                  i === activeIndex && 'bg-slate-50',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(r)}
              >
                <span className="block font-medium text-slate-900 line-clamp-2">{primary}</span>
                <span className="mt-0.5 text-xs text-slate-500">
                  {t('wizardGeo_streetSuggestHint') || 'Поставит точку на карте'}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
