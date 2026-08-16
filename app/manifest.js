import { getPublicBrandDisplayName } from '@/lib/site-url'

/**
 * PWA manifest (Stage 155.3 / 169.4 / 200.4 / 189.31 / 201.59).
 * Splash / home-screen / share title: brand only (`Airento`) — no long tagline.
 *
 * Android Chrome splash = background_color + purpose:"any" icon + name.
 * Do NOT put lockup (logo+text) in icons — Chrome adds the name again → tiny letters
 * in a plate (Stage 201.55 regression).
 *
 * - purpose "any" → icon-dark-* (large mark on navy, matches background_color)
 * - purpose "maskable" → light mark (home-screen adaptive icon, like iOS)
 * Light favicons / apple-touch stay in app/layout.js — not used as Android splash icons.
 */
export default function manifest() {
  const brand = getPublicBrandDisplayName()
  const shortName = brand.length > 12 ? brand.slice(0, 12) : brand
  return {
    name: brand,
    short_name: shortName,
    description: `${brand} — аренда жилья, транспорта, яхт и туров по миру. Онлайн-бронирование и эскроу.`,
    start_url: '/',
    display: 'standalone',
    background_color: '#0c1623',
    theme_color: '#0d9488',
    orientation: 'portrait-primary',
    lang: 'ru',
    dir: 'ltr',
    scope: '/',
    icons: [
      {
        src: '/icons/icon-dark-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-dark-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-dark-1024x1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['travel', 'lifestyle', 'business'],
    shortcuts: [
      {
        name: 'Поиск',
        short_name: 'Поиск',
        description: 'Каталог объявлений',
        url: '/listings',
      },
      {
        name: 'Мои брони',
        short_name: 'Брони',
        description: 'Ваши бронирования',
        url: '/my-bookings',
      },
      {
        name: 'Сообщения',
        short_name: 'Чат',
        description: 'Чаты с партнёрами',
        url: '/messages/',
      },
    ],
  }
}
