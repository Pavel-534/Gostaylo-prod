/**
 * Android PWA splash helpers (Stage 201.60).
 *
 * Honest constraint: Chrome/Samsung splash = background_color + purpose:"any" icon + name.
 * No full-screen apple-touch-startup-image. Lockup-in-icon → tiny letters (201.55).
 *
 * Recipe that reads well when the OS draws a plate:
 * - purpose "any" → large mark on intentional light plate (fills canvas; mark ~80%)
 * - purpose "maskable" → light home icon (unchanged; generated elsewhere)
 * - background_color navy → rest of splash + white “Airento” label
 * - android-splash-* portraits → TWA/Capacitor only (full lockup like iOS)
 *
 * Run: node scripts/build-android-splash-icons.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'icons')
const splashDir = path.join(root, 'public', 'splash')
const markPath = path.join(root, 'public', 'brand', 'airento-mark.svg')
const lockupPath = path.join(root, 'public', 'brand', 'airento-lockup-onbg.png')

const SPLASH_BG_TOP = '#0c1623'
const SPLASH_BG_BOT = '#0a2125'
/** Light plate — intentional card when OS centers the icon on dark splash. */
const PLATE = '#ffffff'
const PLATE_RADIUS_FRAC = 0.18
/** Mark fills most of the plate so it doesn’t look “tiny letters in a box”. */
const MARK_FRAC = 0.82

/** @param {number} w @param {number} h */
function navyBgSvg(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${SPLASH_BG_TOP}"/>
      <stop offset="100%" stop-color="${SPLASH_BG_BOT}"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="#0d9488" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`)
}

/**
 * Full-bleed light plate + large transparent SVG mark (good on light; intentional on dark splash).
 * @param {number} size
 */
async function buildSplashPlateIcon(size) {
  const radius = Math.round(size * PLATE_RADIUS_FRAC)
  const plateSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" rx="${radius}" fill="${PLATE}"/>
</svg>`)

  const markMax = Math.round(size * MARK_FRAC)
  const mark = await sharp(markPath)
    .resize({ width: markMax, height: markMax, fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round((size - mark.info.width) / 2)
  const top = Math.round((size - mark.info.height) / 2)

  return sharp(plateSvg)
    .composite([{ input: mark.data, left, top }])
    .png()
    .toBuffer()
}

/** Full-bleed portrait for native shells (Capacitor/TWA) — lockup like iOS apple-splash. */
async function buildPortraitSplash(w, h) {
  const lockW = Math.round(w * 0.62)
  const lockup = await sharp(lockupPath)
    .resize({ width: lockW, withoutEnlargement: true })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round((w - lockup.info.width) / 2)
  const top = Math.round(h * 0.42 - lockup.info.height / 2)

  return sharp(navyBgSvg(w, h))
    .composite([{ input: lockup.data, left, top }])
    .png()
    .toBuffer()
}

async function main() {
  if (!fs.existsSync(markPath)) throw new Error(`Missing mark: ${markPath}`)
  if (!fs.existsSync(lockupPath)) throw new Error(`Missing lockup: ${lockupPath}`)
  fs.mkdirSync(iconsDir, { recursive: true })
  fs.mkdirSync(splashDir, { recursive: true })

  for (const size of [192, 512, 1024]) {
    const buf = await buildSplashPlateIcon(size)
    const splashOut = path.join(iconsDir, `icon-splash-${size}x${size}.png`)
    fs.writeFileSync(splashOut, buf)
    console.log('wrote', path.relative(root, splashOut))
  }

  // Keep true dark mark icons for surfaces that need navy (not splash plate aliases).
  for (const size of [192, 512, 1024]) {
    const markMax = Math.round(size * 0.7)
    const mark = await sharp(markPath)
      .resize({ width: markMax, height: markMax, fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer({ resolveWithObject: true })
    const left = Math.round((size - mark.info.width) / 2)
    const top = Math.round((size - mark.info.height) / 2)
    const darkOut = path.join(iconsDir, `icon-dark-${size}x${size}.png`)
    fs.writeFileSync(
      darkOut,
      await sharp(navyBgSvg(size, size))
        .composite([{ input: mark.data, left, top }])
        .png()
        .toBuffer(),
    )
    console.log('wrote', path.relative(root, darkOut))
  }

  const maskDark = path.join(iconsDir, 'icon-dark-maskable-512x512.png')
  {
    const size = 512
    const markMax = Math.round(size * 0.56)
    const mark = await sharp(markPath)
      .resize({ width: markMax, height: markMax, fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer({ resolveWithObject: true })
    const left = Math.round((size - mark.info.width) / 2)
    const top = Math.round((size - mark.info.height) / 2)
    fs.writeFileSync(
      maskDark,
      await sharp(navyBgSvg(size, size))
        .composite([{ input: mark.data, left, top }])
        .png()
        .toBuffer(),
    )
    console.log('wrote', path.relative(root, maskDark))
  }

  for (const [w, h] of [
    [1080, 1920],
    [1080, 2400],
    [1440, 3200],
  ]) {
    const out = path.join(splashDir, `android-splash-${w}-${h}.png`)
    fs.writeFileSync(out, await buildPortraitSplash(w, h))
    console.log('wrote', path.relative(root, out), '(native shell only)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
