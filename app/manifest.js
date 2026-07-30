import { getSiteDisplayName } from '@/lib/site-url'

/**
 * PWA manifest (Stage 155.3 / 169.4 / 200.4).
 * Splash / home-screen title: brand only (no long EN tagline — Android shows `name` under the icon).
 * Icons: generated from public/brand/airento-mark.png via scripts/generate-pwa-icons.mjs
 */
export default function manifest() {
  const brand = getSiteDisplayName()
  const defaultName = brand === 'Platform' ? 'Airento' : brand
  const defaultShort = defaultName.length > 12 ? defaultName.slice(0, 12) : defaultName
  return {
    name: defaultName,
    short_name: defaultShort,
    description: `${defaultName} — аренда жилья, транспорта, яхт и туров по миру. Онлайн-бронирование и эскроу.`,
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
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
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
