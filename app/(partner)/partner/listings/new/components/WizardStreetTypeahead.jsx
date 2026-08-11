'use client'

/**
 * Stage 200.83 / 200.84 / 200.85 / 200.89 — street + house on one row;
 * street typing searches without house (Nominatim); house places pin from top hit.
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

function composeNeedle(street, house, { includeHouse = false } = {}) {
  const s = String(street || '').trim()
  const h = String(house || '').trim()
  if (includeHouse && s && h) return `${s}, ${h}`
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
 *   onStreetHouseChange?: (street: string, house: string) => void
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
  onStreetHouseChange = null,
  onSelectResult,
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)
  const resultsRef = useRef([])

  useEffect(() => {
    resultsRef.current = results
  }, [results])

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  /**
   * @param {string} streetVal
   * @param {string} houseVal
   * @param {{ includeHouse?: boolean }} [opts]
   * @returns {Promise<object[]>}
   */
  const runSearch = async (streetVal, houseVal, opts = {}) => {
    const includeHouse = Boolean(opts.includeHouse)
    const needle = composeNeedle(streetVal, houseVal, { includeHouse })
    if (!countryCode || needle.length < 3) {
      setResults([])
      resultsRef.current = []
      return []
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
        const list = [...streetFirst, ...rest].slice(0, 8)
        setResults(list)
        resultsRef.current = list
        setOpen(list.length > 0)
        return list
      }
      setResults([])
      resultsRef.current = []
      return []
    } catch {
      setResults([])
      resultsRef.current = []
      return []
    } finally {
      setLoading(false)
    }
  }

  const scheduleSearch = (streetVal, houseVal, opts = {}) => {
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(streetVal, houseVal, opts)
    }, 280)
  }

  const applyStreetHouse = (nextStreet, nextHouse) => {
    if (typeof onStreetHouseChange === 'function') {
      onStreetHouseChange(nextStreet, nextHouse)
      return
    }
    onStreetChange(nextStreet)
    onHouseChange(nextHouse)
  }

  const pick = async (r) => {
    setOpen(false)
    setResults([])
    resultsRef.current = []
    const addr = r.address && typeof r.address === 'object' ? r.address : null
    let nextStreet = street
    let nextHouse = house
    if (addr) {
      const road = String(addr.road || addr.pedestrian || addr.street || '').trim()
      const hn = String(addr.house_number || '').trim()
      if (road) nextStreet = road
      // Keep typed house if OSM hit has no house_number (street-only suggest).
      if (hn) nextHouse = hn
    }
    applyStreetHouse(nextStreet, nextHouse)
    await onSelectResult(r)
  }

  const placeTopOrSearch = async () => {
    let list = resultsRef.current
    const wantHouse = Boolean(String(house || '').trim())
    list = await runSearch(street, house, { includeHouse: wantHouse })
    if (list[0]) await pick(list[0])
  }

  const showList = open && results.length > 0
  const canLocate = String(street || '').trim().length >= 3 && Boolean(countryCode)

  return (
    <div ref={wrapRef} className="space-y-3">
      {/* Labels + hint in one band; inputs always side-by-side (mobile too). */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-sm font-medium">{t('wizardGeo_streetOnlyLabel')}</Label>
        </div>
        <div className="w-[4.75rem] shrink-0 sm:w-24">
          <Label className="text-sm font-medium">{t('wizardGeo_houseLabel')}</Label>
        </div>
      </div>

      <div className="relative flex items-start gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            className="h-11 w-full pr-10"
            value={street || ''}
            disabled={disabled}
            placeholder={t('wizardGeo_streetOnlyPh')}
            // Custom typeahead — browser address autofill (Samsung/Chrome) shows
            // unrelated saved places e.g. "Main Building, Thaweewong Road…".
            autoComplete="off"
            name="listing-street-manual"
            data-testid="wizard-street-input"
            onChange={(e) => {
              onStreetChange(e.target.value)
              // Street-only needle — do not append house while the name is incomplete
              // (Nominatim often returns nothing for "Славянска, 12").
              scheduleSearch(e.target.value, house, { includeHouse: false })
            }}
            onFocus={() => {
              if (String(street || '').trim().length >= 3) {
                setOpen(true)
                void runSearch(street, house, { includeHouse: false })
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
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>

        <div className="w-[4.75rem] shrink-0 sm:w-24">
          <Input
            className="h-11 w-full"
            value={house || ''}
            disabled={disabled}
            placeholder={t('wizardGeo_housePh')}
            autoComplete="off"
            name="listing-house-manual"
            inputMode="text"
            data-testid="wizard-house-input"
            onChange={(e) => {
              onHouseChange(e.target.value)
              scheduleSearch(street, e.target.value, { includeHouse: true })
            }}
            onFocus={() => {
              if (String(street || '').trim().length >= 3) {
                void runSearch(street, house, {
                  includeHouse: Boolean(String(house || '').trim()),
                })
              } else if (results.length > 0) {
                setOpen(true)
              }
            }}
            onBlur={() => {
              // After house entry: resolve full address and drop the pin (no second tap).
              const hn = String(house || '').trim()
              const st = String(street || '').trim()
              if (!countryCode || st.length < 3 || !hn) return
              window.setTimeout(() => {
                void (async () => {
                  const list = await runSearch(st, hn, { includeHouse: true })
                  if (list[0]) await pick(list[0])
                })()
              }, 180)
            }}
          />
        </div>

        {showList ? (
          <div
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 divide-y overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg"
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
                    'min-h-[44px] w-full px-3 py-2.5 text-left text-sm hover:bg-muted/60',
                    i === activeIndex && 'bg-muted/60',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(r)}
                >
                  <span className="block font-medium line-clamp-1">{primary}</span>
                  {secondary ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                      {secondary}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t('wizardGeo_streetSuggestHint')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t('wizardGeo_addressSuggestHint')}</p>

      {canLocate ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={loading || disabled}
          onClick={() => void placeTopOrSearch()}
          data-testid="wizard-street-use-top"
        >
          {t('wizardGeo_useTopSuggest')}
        </Button>
      ) : null}
    </div>
  )
}
