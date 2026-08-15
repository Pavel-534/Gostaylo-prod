#!/usr/bin/env node
/**
 * Build public/brand/airento-mark-badge.svg — brand mark on a white rounded chip.
 * White is painted inside the SVG so forced-dark CSS cannot invert a CSS background
 * while leaving the teal mark dark (Samsung/Chrome algorithmic dark).
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const markPath = path.join(root, 'public/brand/airento-mark.svg')
const outPath = path.join(root, 'public/brand/airento-mark-badge.svg')

const mark = fs.readFileSync(markPath, 'utf8')
const inner = mark
  .replace(/^[\s\S]*?<svg[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim()

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Airento">
  <!-- White chip is pixel paint inside the image — survives forced-dark CSS inversion -->
  <rect width="128" height="128" rx="28" fill="#ffffff"/>
  <svg x="14" y="16" width="100" height="96" viewBox="48 36 2306 1799" preserveAspectRatio="xMidYMid meet">
${inner}
  </svg>
</svg>
`

fs.writeFileSync(outPath, badge)
console.log('wrote', path.relative(root, outPath), `(${badge.length} bytes)`)
