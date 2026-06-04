/**
 * Export design tokens for Figma (Tokens / Variables plugins).
 * SSOT: lib/theme/tokens.cjs
 *
 * Run: npm run export-tokens
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { designTokens } = require('../lib/theme/tokens.cjs')

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(repoRoot, 'docs', 'design-tokens.json')

const payload = {
  meta: {
    source: 'lib/theme/tokens.cjs',
    exportedAt: new Date().toISOString(),
    tailwind: 'tailwind.config.js → toTailwindExtend()',
    displayName:
      'White-label name is NOT in tokens — set NEXT_PUBLIC_SITE_NAME / SITE_DISPLAY_NAME (lib/site-url.js).',
  },
  ...designTokens,
}

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`export-figma-tokens: wrote ${outPath}`)
