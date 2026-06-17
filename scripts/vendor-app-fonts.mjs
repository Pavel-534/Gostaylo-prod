/**
 * Copies UI woff2 assets from @fontsource-variable into lib/assets/fonts/web/.
 * Run after upgrading font packages: `node scripts/vendor-app-fonts.mjs`
 */

import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'lib', 'assets', 'fonts', 'web')

const files = [
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-italic.woff2', 'inter-latin-wght-italic.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2', 'inter-cyrillic-wght-normal.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-italic.woff2', 'inter-cyrillic-wght-italic.woff2'],
  [
    'node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2',
    'cormorant-garamond-latin-wght-normal.woff2',
  ],
  [
    'node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2',
    'cormorant-garamond-latin-wght-italic.woff2',
  ],
  [
    'node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-cyrillic-wght-normal.woff2',
    'cormorant-garamond-cyrillic-wght-normal.woff2',
  ],
  [
    'node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-cyrillic-wght-italic.woff2',
    'cormorant-garamond-cyrillic-wght-italic.woff2',
  ],
]

mkdirSync(dest, { recursive: true })

for (const [srcRel, name] of files) {
  copyFileSync(join(root, srcRel), join(dest, name))
  console.log(`[vendor-app-fonts] ${name}`)
}

console.log('[vendor-app-fonts] done')
