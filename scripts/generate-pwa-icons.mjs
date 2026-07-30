/**
 * Generate PWA / favicon PNGs from brand mark (public/brand/airento-mark.png).
 * Usage: node scripts/generate-pwa-icons.mjs
 *
 * Stage 200.4 — replace legacy "FR" placeholder with Airento mark.
 */

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/icons')
const markPath = path.join(root, 'public/brand/airento-mark.png')

/** Splash / Android chrome — matches app/manifest.js background_color */
const BG = '#0f172a'
/** Inner plate so teal/gray mark stays readable on dark chrome */
const PLATE = '#ffffff'

if (!fs.existsSync(markPath)) {
  console.error('Missing brand mark:', markPath)
  process.exit(1)
}

/**
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
async function composeIcon(size) {
  const pad = Math.round(size * 0.12)
  const plateSize = size - pad * 2
  const radius = Math.round(plateSize * 0.18)
  const markPad = Math.round(plateSize * 0.14)
  const markBox = plateSize - markPad * 2

  const markMeta = await sharp(markPath).metadata()
  const mw = markMeta.width || 1
  const mh = markMeta.height || 1
  const scale = Math.min(markBox / mw, markBox / mh)
  const markW = Math.max(1, Math.round(mw * scale))
  const markH = Math.max(1, Math.round(mh * scale))

  const markBuf = await sharp(markPath)
    .resize(markW, markH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer()

  const plateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plateSize}" height="${plateSize}">
      <rect width="${plateSize}" height="${plateSize}" rx="${radius}" fill="${PLATE}"/>
    </svg>`,
  )

  const plate = await sharp(plateSvg)
    .composite([
      {
        input: markBuf,
        left: Math.round((plateSize - markW) / 2),
        top: Math.round((plateSize - markH) / 2),
      },
    ])
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: plate, left: pad, top: pad }])
    .png()
    .toBuffer()
}

const targets = [
  { size: 512, name: 'icon-512x512.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 180, name: 'icon-180x180.png' },
  { size: 72, name: 'badge-72x72.png' },
  { size: 32, name: 'icon-32x32.png' },
]

for (const { size, name } of targets) {
  const buf = await composeIcon(size)
  await sharp(buf).toFile(path.join(outDir, name))
  console.log('wrote', name)
}

/** Keep SVG in sync so old FR never regenerates by hand. */
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Airento">
  <rect width="512" height="512" fill="${BG}"/>
  <rect x="61" y="61" width="390" height="390" rx="70" fill="${PLATE}"/>
  <text x="256" y="290" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" fill="#64748b">See airento-mark.png</text>
</svg>
`
fs.writeFileSync(path.join(outDir, 'icon-512x512.svg'), svg)
console.log('wrote icon-512x512.svg (placeholder note)')

await sharp(await composeIcon(32)).toFile(path.join(root, 'public/favicon.png'))
console.log('wrote public/favicon.png')
