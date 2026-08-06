'use client'

/**
 * Stage 200.45 / 200.46 — city typeahead + blur/Enter commit for manual labels.
 */

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import {
  normalizeGeoPlaceKey,
  normalizeGeoPlaceName,
} from '@/lib/geo/normalize-geo-place-name'
import { cn } from '@/lib/utils'

function isCityLike(r) {
  const level = String(r.level || r.type || '').toLowerCase()
  if (['city', 'neighborhood', 'town', 'village', 'municipality', 'suburb'].includes(level)) {
    return true
  }
  if (r.cityCode) return true
  if (r.address?.city || r.address?.town || r.address?.municipality) return true
  if (level === 'country' || level === 'region' || level === 'state') return false
  return Boolean(r.lat != null && r.lon != null)
}

function resultLabel(r) {
  return normalizeGeoPlaceName(
    r.labelRu || r.labelEn || r.address?.city || r.address?.town || r.displayName,
  )
}

/**
 * @param {{
 *   countryCode: string,
 *   valueLabel: string,
 *   disabled?: boolean,
 *   hasError?: boolean,
 *   placeholder?: string,
 *   manualOptionLabel?: string,
 *   className?: string,
 *   t: (key: string) => string,
 *   onSelectResult: (result: object) => void | Promise<void>,
 *   onSelectManual: (label: string) => void,
 *   onClear?: () => void,
 * }} props
 */
export function WizardCityTypeahead({
  countryCode,
  valueLabel,
  disabled = false,
  hasError = false,
  placeholder,
  manualOptionLabel,
  className,
  t,
  onSelectResult,
  onSelectManual,
  onClear,
}) {
  const [query, setQuery] = useState(() => valueLabel || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    setQuery(valueLabel || '')
  }, [valueLabel, countryCode])

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
      const res = await fetch(
        `/api/v2/geocode/suggest?q=${encodeURIComponent(needle)}&country=${encodeURIComponent(countryCode)}`,
        { cache: 'no-store' },
      )
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success && Array.isArray(json.data)) {
        setResults(json.data.filter(isCityLike).slice(0, 10))
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const onChange = (value) => {
    setQuery(value)
    setOpen(true)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 300)
  }

  const pickResult = async (r) => {
    skipBlurCommitRef.current = true
    const label = resultLabel(r) || String(r.displayName || '')
    setQuery(label)
    setOpen(false)
    setResults([])
    setActiveIndex(-1)
    await onSelectResult({ ...r, _normalizedLabel: label })
  }

  const pickManual = (raw = query) => {
    skipBlurCommitRef.current = true
    const label = normalizeGeoPlaceName(raw)
    if (label.length < 2) return
    setQuery(label)
    setOpen(false)
    setResults([])
    setActiveIndex(-1)
    onSelectManual(label)
  }

  const commitFromQuery = () => {
    const normalized = normalizeGeoPlaceName(query)
    if (!countryCode) return

    if (!normalized) {
      if (valueLabel) {
        setQuery('')
        onClear?.()
      }
      return
    }

    if (normalizeGeoPlaceKey(normalized) === normalizeGeoPlaceKey(valueLabel || '')) {
      setQuery(normalized)
      return
    }

    const exact = results.find((r) => normalizeGeoPlaceKey(resultLabel(r)) === normalizeGeoPlaceKey(normalized))
    if (exact) {
      void pickResult(exact)
      return
    }
    pickManual(normalized)
  }

  const onBlur = () => {
    // Defer so mousedown on suggestion can set skip flag first
    window.setTimeout(() => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false
        return
      }
      setOpen(false)
      commitFromQuery()
    }, 120)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0 && results[activeIndex]) {
        void pickResult(results[activeIndex])
        return
      }
      commitFromQuery()
      setOpen(false)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showManual =
    open &&
    Boolean(countryCode) &&
    normalizeGeoPlaceName(query).length >= 2 &&
    !disabled

  return (
    <div ref={wrapRef} className={cn('relative', className)} data-testid="wizard-city-typeahead-wrap">
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        data-testid="wizard-city-typeahead"
        className={cn('h-11 min-h-[44px] pr-10', hasError && 'border-red-400 ring-1 ring-red-400')}
        onFocus={() => setOpen(true)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : null}
      {open && (results.length > 0 || showManual) ? (
        <div
          className="absolute z-30 mt-1 max-h-56 w-full divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
          data-testid="wizard-city-suggestions"
        >
          {results.map((r, i) => {
            const primary =
              r.labelRu || r.labelEn || r.address?.city || r.address?.town || r.displayName
            const secondary =
              r.labelEn && r.labelRu && r.labelEn !== r.labelRu ? r.labelEn : null
            return (
              <button
                key={`${r.code || ''}-${r.lat}-${r.lon}-${i}`}
                type="button"
                data-testid={`wizard-city-option-${i}`}
                className={cn(
                  'min-h-[44px] w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50',
                  activeIndex === i && 'bg-slate-50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  skipBlurCommitRef.current = true
                }}
                onClick={() => pickResult(r)}
              >
                <span className="block font-medium text-slate-900">{primary}</span>
                {secondary || r.displayName ? (
                  <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {secondary || (r.displayName !== primary ? r.displayName : null)}
                  </span>
                ) : null}
              </button>
            )
          })}
          {showManual ? (
            <button
              type="button"
              data-testid="wizard-city-manual-option"
              className="min-h-[44px] w-full px-3 py-2.5 text-left text-sm font-medium text-brand hover:bg-brand/5"
              onMouseDown={(e) => {
                e.preventDefault()
                skipBlurCommitRef.current = true
              }}
              onClick={() => pickManual()}
            >
              {manualOptionLabel || t('wizardGeo_cityManualOption')}: «
              {normalizeGeoPlaceName(query)}»
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
