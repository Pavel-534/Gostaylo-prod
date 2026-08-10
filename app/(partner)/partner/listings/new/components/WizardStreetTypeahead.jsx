'use client'

/**
 * Stage 200.83 / 200.84 / 200.85 — street + house; suggestions dock under street.
 */

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, MapPin } from 'lucide-react'
import { cityViewboxFromCentroid, formatListingStreetAddress } from '@/lib/geo/nominatim-lang'
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

/** Compact line for the dropdown — not the full OSM hierarchy. */
function resultLines(r, cityLabel) {
  const addr = r.address && typeof r.address === 'object' ? r.address : null
  const primary =
    formatListingStreetAddress(addr, null) ||
    String(addr?.road || addr?.pedestrian || addr?.street || '').trim() ||
    String(r.labelRu || r.labelEn || '').trim() ||
    String(r.displayName || '')
      .split(',')[0]
      ?.trim() ||
    ''
  const city = String(addr?.city || addr?.town || addr?.municipality || cityLabel || '').trim()
  const district = String(addr?.suburb || addr?.neighbourhood || addr?.city_district || '').trim()
  const secondary = [district, city].filter(Boolean).join(' · ')
  return { primary, secondary }
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
        setOpen(true)
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
    }
    await onSelectResult(r)
  }

  const showList = open && results.length > 0
  const canLocate = composeNeedle(street, house).length >= 3 && Boolean(countryCode)

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Street: suggestions dock here so they sit under the field being typed */}
        <div className="relative min-w-0 flex-1">
          <Label className="text-sm font-medium">{t('wizardGeo_streetOnlyLabel')}</Label>
          <p className="mt-0.5 text-xs text-slate-500">{t('wizardGeo_addressSuggestHint')}</p>
          <div className="relative mt-1.5">
            <Input
              className="h-11 w-full pr-10"
              value={street || ''}
              disabled={disabled}
              placeholder={t('wizardGeo_streetOnlyPh')}
              autoComplete="street-address"
              data-testid="wizard-street-input"
              onChange={(e) => {
                onStreetChange(e.target.value)
                scheduleSearch(e.target.value, house)
              }}
              onFocus={() => {
                if (composeNeedle(street, house).length >= 3) {
                  setOpen(true)
                  void runSearch(street, house)
                } else if (results.length > 0) {
                  setOpen(true)
                }
              }}
              onKeyDown={(e) => {
                if (!showList) return
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
              aria-expanded={showList}
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : (
              <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            )}
          </div>

          {showList ? (
            <div
              className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
              role="listbox"
              data-testid="wizard-street-suggestions"
            >
              {results.map((r, i) => {
                const { primary, secondary } = resultLines(r, cityLabel)
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
                    <span className="block font-medium text-slate-900 line-clamp-1">{primary}</span>
                    {secondary ? (
                      <span className="mt-0.5 block text-xs text-slate-500 line-clamp-1">
                        {secondary}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t('wizardGeo_streetSuggestHint')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="w-full shrink-0 sm:w-28">
          <Label className="text-sm font-medium">{t('wizardGeo_houseLabel')}</Label>
          <Input
            className="mt-1.5 h-11 w-full sm:mt-[1.625rem]"
            value={house || ''}
            disabled={disabled}
            placeholder={t('wizardGeo_housePh')}
            autoComplete="off"
            inputMode="text"
            data-testid="wizard-house-input"
            onChange={(e) => {
              onHouseChange(e.target.value)
              scheduleSearch(street, e.target.value)
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true)
            }}
          />
        </div>
      </div>

      {canLocate && showList ? (
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
