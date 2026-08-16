/**
 * Android / Chrome PWA splash icons (Stage 201.55).
 * Same recipe as iOS apple-splash: navy→teal gradient + radial teal glow + lockup.
 * Run: node scripts/build-android-splash-icons.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'icons')
const splashDir = path.join(root, 'public', 'splash')
const lockupPath = path.join(root, 'public', 'brand', 'airento-lockup-onbg.png')

/** @param {number} size */
async function buildSquareSplash(size) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c1623"/>
      <stop offset="100%" stop-color="#0a2125"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.38"/>
      <stop offset="55%" stop-color="#0d9488" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`)

  const lockW = Math.round(size * 0.78)
  const lockup = await sharp(lockupPath)
    .resize({ width: lockW, withoutEnlargement: true })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round((size - lockup.info.width) / 2)
  const top = Math.round(size * 0.42 - lockup.info.height / 2)

  return sharp(svg)
    .composite([{ input: lockup.data, left, top }])
    .png()
    .toBuffer()
}

/** @param {number} w @param {number} h */
async function buildPortraitSplash(w, h) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c1623"/>
      <stop offset="100%" stop-color="#0a2125"/>
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

  const lockW = Math.round(w * 0.62)
  const lockup = await sharp(lockupPath)
    .resize({ width: lockW, withoutEnlargement: true })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round((w - lockup.info.width) / 2)
  const top = Math.round(h * 0.42 - lockup.info.height / 2)

  return sharp(svg)
    .composite([{ input: lockup.data, left, top }])
    .png()
    .toBuffer()
}

async function main() {
  if (!fs.existsSync(lockupPath)) {
    throw new Error(`Missing lockup: ${lockupPath}`)
  }
  fs.mkdirSync(iconsDir, { recursive: true })
  fs.mkdirSync(splashDir, { recursive: true })

  for (const size of [192, 512, 1024]) {
    const buf = await buildSquareSplash(size)
    const out = path.join(iconsDir, `icon-android-splash-${size}x${size}.png`)
    fs.writeFileSync(out, buf)
    console.log('wrote', path.relative(root, out))
  }

  // Maskable: tighter lockup so OS crop keeps brand readable
  const maskOut = path.join(iconsDir, 'icon-android-splash-maskable-512x512.png')
  const maskSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c1623"/>
      <stop offset="100%" stop-color="#0a2125"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`)
  const lockSafe = await sharp(lockupPath)
    .resize({ width: Math.round(512 * 0.56), withoutEnlargement: true })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })
  const mLeft = Math.round((512 - lockSafe.info.width) / 2)
  const mTop = Math.round(512 * 0.42 - lockSafe.info.height / 2)
  fs.writeFileSync(
    maskOut,
    await sharp(maskSvg)
      .composite([{ input: lockSafe.data, left: mLeft, top: mTop }])
      .png()
      .toBuffer(),
  )
  console.log('wrote', path.relative(root, maskOut))

  const portrait = [
    [1080, 1920],
    [1080, 2400],
    [1440, 3200],
  ]
  for (const [w, h] of portrait) {
    const buf = await buildPortraitSplash(w, h)
    const out = path.join(splashDir, `android-splash-${w}-${h}.png`)
    fs.writeFileSync(out, buf)
    console.log('wrote', path.relative(root, out))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
