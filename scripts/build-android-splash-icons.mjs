/**
 * Android PWA splash helpers (Stage 201.59).
 *
 * Chrome/Samsung do NOT use apple-touch-startup-image. Splash = background_color +
 * manifest icon (purpose "any") + app name. Putting a lockup (logo+text) into the
 * icon makes tiny letters + Chrome’s own “Airento” label (the 201.55 regression).
 *
 * This script builds:
 * 1) icon-dark-* — large mark only on iOS-parity navy (#0c1623) → purpose "any" splash
 * 2) android-splash-* portraits — full lockup screens for TWA/Capacitor (not webmanifest icons)
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

const BG_TOP = '#0c1623'
const BG_BOT = '#0a2125'

/** @param {number} w @param {number} h */
function bgSvg(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}"/>
      <stop offset="100%" stop-color="${BG_BOT}"/>
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
 * Square dark mark icon — no wordmark (safe for Chrome splash + home fallback).
 * @param {number} size
 * @param {number} markFrac fraction of canvas width for the mark
 */
async function buildDarkMarkIcon(size, markFrac) {
  const markMax = Math.round(size * markFrac)
  const mark = await sharp(markPath)
    .resize({ width: markMax, height: markMax, fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round((size - mark.info.width) / 2)
  const top = Math.round((size - mark.info.height) / 2)

  return sharp(bgSvg(size, size))
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

  return sharp(bgSvg(w, h))
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
    const out = path.join(iconsDir, `icon-dark-${size}x${size}.png`)
    fs.writeFileSync(out, await buildDarkMarkIcon(size, 0.7))
    console.log('wrote', path.relative(root, out))
  }

  const maskOut = path.join(iconsDir, 'icon-dark-maskable-512x512.png')
  fs.writeFileSync(maskOut, await buildDarkMarkIcon(512, 0.56))
  console.log('wrote', path.relative(root, maskOut))

  // Remove mistaken 201.55 lockup-as-launcher assets if present
  for (const name of [
    'icon-android-splash-192x192.png',
    'icon-android-splash-512x512.png',
    'icon-android-splash-1024x1024.png',
    'icon-android-splash-maskable-512x512.png',
  ]) {
    const p = path.join(iconsDir, name)
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
      console.log('removed', path.relative(root, p))
    }
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
