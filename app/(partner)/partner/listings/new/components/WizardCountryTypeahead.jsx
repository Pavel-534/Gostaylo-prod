'use client'

/**
 * Stage 200.45 — country ISO typeahead for partner listing wizard.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import {
  filterIsoCountries,
  getIsoCountryLabel,
  listIsoCountries,
} from '@/lib/geo/iso-countries-catalog'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   value: string,
 *   language?: string,
 *   disabled?: boolean,
 *   hasError?: boolean,
 *   placeholder?: string,
 *   className?: string,
 *   onSelect: (code: string, meta: { label: string, row?: object }) => void | Promise<void>,
 * }} props
 */
export function WizardCountryTypeahead({
  value,
  language = 'ru',
  disabled = false,
  hasError = false,
  placeholder,
  className,
  onSelect,
}) {
  const [query, setQuery] = useState(() =>
    value ? getIsoCountryLabel(value, language) : '',
  )
  const [open, setOpen] = useState(false)
  const [dbExtra, setDbExtra] = useState([])
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/v2/geo/locations?level=country&lang=${language}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && Array.isArray(json.data)) {
          setDbExtra(json.data.map((r) => ({ code: r.code, label: r.label })))
        }
      } catch {
        /* ISO list still works offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [language])

  useEffect(() => {
    if (value) {
      setQuery(getIsoCountryLabel(value, language))
    } else if (!open) {
      setQuery('')
    }
  }, [value, language, open])

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const catalog = useMemo(
    () => listIsoCountries({ lang: language, extra: dbExtra }),
    [language, dbExtra],
  )

  const suggestions = useMemo(
    () => filterIsoCountries(catalog, query, 12),
    [catalog, query],
  )

  const pick = async (row) => {
    setQuery(row.label)
    setOpen(false)
    // Fire-and-forget busy for ensure-country; parent applies country immediately
    setBusy(true)
    try {
      await onSelect(row.code, { label: row.label, row })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)} data-testid="wizard-country-typeahead-wrap">
      <Input
        value={query}
        disabled={disabled || busy}
        placeholder={placeholder}
        autoComplete="off"
        data-testid="wizard-country-typeahead"
        className={cn('h-11 min-h-[44px] pr-10', hasError && 'border-red-400 ring-1 ring-red-400')}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {busy ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : null}
      {open && suggestions.length > 0 ? (
        <div
          className="absolute z-30 mt-1 max-h-56 w-full divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
          data-testid="wizard-country-suggestions"
        >
          {suggestions.map((row) => (
            <button
              key={row.code}
              type="button"
              data-testid={`wizard-country-option-${row.code}`}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(row)}
            >
              <span className="font-medium text-slate-900">{row.label}</span>
              <span className="text-xs tabular-nums text-slate-400">{row.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
