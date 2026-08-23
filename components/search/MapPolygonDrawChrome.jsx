'use client'

/**
 * Stage 177.5.1 — Leaflet Geoman polygon draw (lazy-loaded on Pencil click).
 * Must only mount on desktop lg+ map panel — never CatalogMobileMapSheet.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import { Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { validateAndEncodePolygonForSearchUrl } from '@/lib/search/discovery-geo-polygon-browser'

/**
 * @param {{
 *   language?: string,
 *   enablePolygonDraw?: boolean,
 *   appliedPolygon?: string | null,
 *   onPolygonEncoded?: (encoded: string) => void,
 *   onPolygonCleared?: () => void,
 * }} props
 */
export function MapPolygonDrawChrome({
  language = 'ru',
  enablePolygonDraw = false,
  appliedPolygon = null,
  onPolygonEncoded,
  onPolygonCleared,
}) {
  const map = useMap()
  const [geomanReady, setGeomanReady] = useState(false)
  const [loadingGeoman, setLoadingGeoman] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const drawLayerRef = useRef(null)
  const LRef = useRef(null)

  const clearDrawLayer = useCallback(() => {
    const layer = drawLayerRef.current
    if (layer && map) {
      try {
        map.removeLayer(layer)
      } catch {
        /* ignore */
      }
    }
    drawLayerRef.current = null
  }, [map])

  useEffect(() => {
    if (!enablePolygonDraw || !map) return undefined

    const onCreate = async (e) => {
      const layer = e?.layer
      if (!layer) return
      clearDrawLayer()
      drawLayerRef.current = layer
      try {
        layer.pm?.disable()
      } catch {
        /* ignore */
      }
      const gj = layer.toGeoJSON?.()
      const geometry = gj?.geometry || gj
      const result = await validateAndEncodePolygonForSearchUrl(geometry)
      setDrawing(false)
      try {
        map.pm?.disableDraw?.()
      } catch {
        /* ignore */
      }
      if (!result.ok) {
        setErrorMsg(result.message)
        clearDrawLayer()
        return
      }
      setErrorMsg(null)
      onPolygonEncoded?.(result.encoded)
    }

    map.on('pm:create', onCreate)
    return () => {
      map.off('pm:create', onCreate)
      try {
        map.pm?.disableDraw?.()
      } catch {
        /* ignore */
      }
    }
  }, [enablePolygonDraw, map, clearDrawLayer, onPolygonEncoded])

  useEffect(() => {
    if (!appliedPolygon) {
      clearDrawLayer()
    }
  }, [appliedPolygon, clearDrawLayer])

  const ensureGeoman = useCallback(async () => {
    if (geomanReady) return true
    setLoadingGeoman(true)
    try {
      const L = (await import('leaflet')).default
      await import('@geoman-io/leaflet-geoman-free')
      await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
      LRef.current = L
      if (!map.pm) {
        throw new Error('Leaflet.pm unavailable after Geoman import')
      }
      map.pm.setLang(language === 'ru' ? 'ru' : 'en')
      setGeomanReady(true)
      return true
    } catch (err) {
      console.warn('[MapPolygonDraw] Geoman load failed', err?.message || err)
      setErrorMsg(
        language === 'ru'
          ? 'Не удалось загрузить инструмент рисования'
          : 'Could not load drawing tools',
      )
      return false
    } finally {
      setLoadingGeoman(false)
    }
  }, [geomanReady, map, language])

  const startDraw = useCallback(async () => {
    if (!enablePolygonDraw) return
    setErrorMsg(null)
    const ok = await ensureGeoman()
    if (!ok) return
    clearDrawLayer()
    setDrawing(true)
    map.pm.enableDraw('Polygon', {
      snappable: true,
      snapDistance: 15,
      finishOn: 'dblclick',
      allowSelfIntersection: false,
    })
  }, [enablePolygonDraw, ensureGeoman, clearDrawLayer, map])

  const cancelDraw = useCallback(() => {
    setDrawing(false)
    try {
      map.pm?.disableDraw?.()
    } catch {
      /* ignore */
    }
  }, [map])

  const handleClear = useCallback(() => {
    cancelDraw()
    clearDrawLayer()
    setErrorMsg(null)
    onPolygonCleared?.()
  }, [cancelDraw, clearDrawLayer, onPolygonCleared])

  if (!enablePolygonDraw && !appliedPolygon) return null

  const hasArea = Boolean(appliedPolygon)
  const drawLabel = language === 'ru' ? 'Нарисовать область' : 'Draw area'
  const clearLabel = language === 'ru' ? 'Сбросить' : 'Clear'
  const chipLabel = language === 'ru' ? 'Область ограничена' : 'Area limited'
  const cancelLabel = language === 'ru' ? 'Отмена' : 'Cancel'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex flex-col items-center gap-2 px-3">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
        {enablePolygonDraw && !hasArea ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              'min-h-[44px] gap-1.5 rounded-2xl border border-slate-200 bg-white/95 shadow-md',
              drawing && 'ring-2 ring-brand-mint',
            )}
            disabled={loadingGeoman}
            onClick={drawing ? cancelDraw : startDraw}
            aria-pressed={drawing}
          >
            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-sm font-medium">
              {loadingGeoman
                ? language === 'ru'
                  ? 'Загрузка…'
                  : 'Loading…'
                : drawing
                  ? cancelLabel
                  : drawLabel}
            </span>
          </Button>
        ) : null}

        {hasArea ? (
          <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-md">
            <span className="text-sm font-medium text-slate-800">{chipLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] gap-1 rounded-xl px-2"
              onClick={handleClear}
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="text-sm">{clearLabel}</span>
            </Button>
          </div>
        ) : null}
      </div>
      {errorMsg ? (
        <p className="pointer-events-auto max-w-sm rounded-xl bg-white/95 px-3 py-2 text-center text-xs text-red-600 shadow">
          {errorMsg}
        </p>
      ) : null}
      {drawing ? (
        <p className="pointer-events-none rounded-xl bg-brand-navy/90 px-3 py-1.5 text-center text-xs text-white shadow">
          {language === 'ru'
            ? 'Кликните по карте, замкните контур двойным кликом'
            : 'Click the map; double-click to finish the outline'}
        </p>
      ) : null}
    </div>
  )
}
