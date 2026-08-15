/**
 * Shared helpers for dynamic OG cards (next/og ImageResponse, nodejs runtime).
 * - publicFileDataUri: inline a /public asset as data URI (robust, no runtime fetch)
 * - loadOgFont: NotoSans TTF (covers Latin + Cyrillic) so RU/EN names render (no tofu)
 */
import fs from 'node:fs'
import path from 'node:path'

export function publicFileDataUri(relPath, mime = 'image/png') {
  try {
    const p = path.join(process.cwd(), 'public', relPath)
    return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`
  } catch {
    return null
  }
}

let _fontCache
export function loadOgFont() {
  if (_fontCache !== undefined) return _fontCache
  try {
    const p = path.join(process.cwd(), 'lib/assets/fonts/partner-pdf/NotoSans-Regular.ttf')
    _fontCache = fs.readFileSync(p)
  } catch {
    _fontCache = null
  }
  return _fontCache
}

export function ogFonts() {
  const data = loadOgFont()
  if (!data) return undefined
  // same outlines for 400/700 — reliable glyph coverage over faux-bold correctness
  return [
    { name: 'Noto', data, weight: 400, style: 'normal' },
    { name: 'Noto', data, weight: 700, style: 'normal' },
  ]
}

/** Absolutize a possibly-relative public image URL for Satori. */
export function absolutize(url, baseUrl) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!baseUrl) return url
  return `${String(baseUrl).replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`
}

export const OG_BG = 'linear-gradient(135deg, #0b1220 0%, #0a2a2e 60%, #0d3b39 100%)'
