import { getPublicBrandDisplayName } from '@/lib/site-url'

/**
 * PWA manifest (Stage 155.3 / 169.4 / 200.4 / 189.31 / 201.60).
 * Splash / home-screen / share title: brand only (`Airento`) — no long tagline.
 *
 * Android splash constraint (honest): OS builds splash from background_color +
 * purpose:"any" icon + name — not a full iOS apple-splash frame.
 *
 * - purpose "any" → icon-splash-* (large mark on white plate; intentional when OS
 *   centers a square on navy background_color)
 * - purpose "maskable" → light icon-maskable-512 (home adaptive, like iOS mark)
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
        src: '/icons/icon-splash-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-splash-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-splash-1024x1024.png',
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
