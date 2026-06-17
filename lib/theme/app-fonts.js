/**
 * Self-hosted UI fonts (Stage 156.2) — no Google Fonts fetch at `next build`.
 * Sources: OFL files in `lib/assets/fonts/web/` (see `npm run fonts:vendor`).
 */

import localFont from 'next/font/local'

export const inter = localFont({
  src: [
    {
      path: '../assets/fonts/web/inter-cyrillic-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/web/inter-cyrillic-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
    {
      path: '../assets/fonts/web/inter-latin-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/web/inter-latin-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const cormorant = localFont({
  src: [
    {
      path: '../assets/fonts/web/cormorant-garamond-cyrillic-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/web/cormorant-garamond-cyrillic-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
    {
      path: '../assets/fonts/web/cormorant-garamond-latin-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/web/cormorant-garamond-latin-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-serif',
  display: 'swap',
})
