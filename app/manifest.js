import { getPublicBrandDisplayName } from '@/lib/site-url'

/**
 * PWA manifest (Stage 155.3 / 169.4 / 200.4 / 189.31).
 * Splash / home-screen / share title: brand only (`Airento`) — no long tagline
 * (iOS Share sheet and Add to Home Screen otherwise pick up page title leftovers).
 * Icons: generated from public/brand/airento-mark.svg via scripts/generate-brand-icons.py
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
    background_color: '#0f172a',
    theme_color: '#0d9488',
    orientation: 'portrait-primary',
    lang: 'ru',
    dir: 'ltr',
    scope: '/',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-1024x1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
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
