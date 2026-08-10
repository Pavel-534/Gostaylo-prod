'use client'

/**
 * Stage 200.83 / 200.84 — street + house fields with city-bounded suggest → pin.
 */

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, MapPin } from 'lucide-react'
import { cityViewboxFromCentroid } from '@/lib/geo/nominatim-lang'
import { cn } from '@/lib/utils'

function isStreetLike(r) {
  const level = String(r.level || r.type || '').toLowerCase()
  if (['country', 'region', 'state', 'city', 'town', 'municipality'].includes(level)) {
    return false
  }
  if (['house', 'building', 'street', 'road', 'residential', 'address', 'amenity'].includes(level)) {
    return true
  }
  return Boolean(r.lat != null && r.lon != null && (r.displayName || r.labelEn || r.labelRu))
}

function resultPrimary(r) {
  return r.displayName || r.labelRu || r.labelEn || ''
}

function composeNeedle(street, house) {
  const s = String(street || '').trim()
  const h = String(house || '').trim()
  if (s && h) return `${s}, ${h}`
  return s
}

/**
 * @param {{
 *   countryCode?: string|null
 *   cityLabel?: string|null
 *   cityLat?: number|null
 *   cityLon?: number|null
 *   language?: string
 *   street: string
 *   house: string
 *   disabled?: boolean
 *   t: (key: string) => string
 *   onStreetChange: (value: string) => void
 *   onHouseChange: (value: string) => void
 *   onSelectResult: (result: object) => void | Promise<void>
 * }} props
 */
export function WizardStreetTypeahead({
  countryCode,
  cityLabel,
  cityLat = null,
  cityLon = null,
  language = 'ru',
  street,
  house,
  disabled = false,
  t,
  onStreetChange,
  onHouseChange,
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

  const runSearch = async (streetVal, houseVal) => {
    const needle = composeNeedle(streetVal, houseVal)
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
      const params = new URLSearchParams({
        q: composed,
        country: String(countryCode),
        lang: String(language || 'ru'),
      })
      const vb = cityViewboxFromCentroid(Number(cityLat), Number(cityLon))
      if (vb) {
        params.set('viewbox', vb)
        params.set('bounded', '1')
      }
      const res = await fetch(`/api/v2/geocode/suggest?${params}`, { cache: 'no-store' })
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

  const scheduleSearch = (streetVal, houseVal) => {
    setOpen(true)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(streetVal, houseVal), 300)
  }

  const pick = async (r) => {
    setOpen(false)
    setResults([])
    const addr = r.address && typeof r.address === 'object' ? r.address : null
    if (addr) {
      const road = String(addr.road || addr.pedestrian || addr.street || '').trim()
      const hn = String(addr.house_number || '').trim()
      if (road) onStreetChange(road)
      if (hn) onHouseChange(hn)
      else if (!hn && house) {
        /* keep typed house if OSM result is road-only */
      }
    }
    await onSelectResult(r)
  }

  const canLocate = composeNeedle(street, house).length >= 3 && Boolean(countryCode)

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7.5rem]">
        <div>
          <Label className="text-sm font-medium">{t('wizardGeo_streetOnlyLabel')}</Label>
          <div className="relative mt-1.5">
            <Input
              className="h-11 w-full pr-10"
              value={street || ''}
              disabled={disabled}
              placeholder={t('wizardGeo_streetOnlyPh')}
              autoComplete="street-address"
              onChange={(e) => {
                onStreetChange(e.target.value)
                scheduleSearch(e.target.value, house)
              }}
              onFocus={() => {
                if (composeNeedle(street, house).length >= 3) {
                  setOpen(true)
                  void runSearch(street, house)
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
        </div>
        <div>
          <Label className="text-sm font-medium">{t('wizardGeo_houseLabel')}</Label>
          <Input
            className="mt-1.5 h-11 w-full"
            value={house || ''}
            disabled={disabled}
            placeholder={t('wizardGeo_housePh')}
            autoComplete="off"
            inputMode="text"
            onChange={(e) => {
              onHouseChange(e.target.value)
              scheduleSearch(street, e.target.value)
            }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">{t('wizardGeo_addressSuggestHint')}</p>

      {open && results.length > 0 ? (
        <div
          className="z-30 max-h-56 w-full divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
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
                  {t('wizardGeo_streetSuggestHint')}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {canLocate && results.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => void pick(results[0])}
          data-testid="wizard-street-use-top"
        >
          {t('wizardGeo_useTopSuggest')}
        </Button>
      ) : null}
    </div>
  )
}
