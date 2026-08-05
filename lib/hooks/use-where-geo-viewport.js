'use client'

/**
 * Stage 200.37 — resolve catalog where → map center/zoom + sort centroid (geo_locations).
 */

import { useEffect, useState } from 'react'

const SEA_DEFAULT = { center: [20, 100], zoom: 6, sortCenter: null }

/**
 * @param {string|null|undefined} where
 * @param {string} [lang]
 */
export function useWhereGeoViewport(where, lang = 'ru') {
  const [view, setView] = useState(SEA_DEFAULT)

  useEffect(() => {
    const w = String(where || '').trim()
    if (!w || w === 'all') {
      setView(SEA_DEFAULT)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/v2/geo/resolve-where?q=${encodeURIComponent(w)}&lang=${encodeURIComponent(lang)}`,
          { cache: 'no-store' },
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (json.success && json.data?.center) {
          const { lat, lng } = json.data.center
          setView({
            center: [lat, lng],
            zoom: Number(json.data.zoom) || 10,
            sortCenter: { lat, lng },
            label: json.data.label || null,
          })
        } else {
          setView(SEA_DEFAULT)
        }
      } catch {
        if (!cancelled) setView(SEA_DEFAULT)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [where, lang])

  return view
}
