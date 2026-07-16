import { getSiteDisplayName } from '@/lib/site-url'

/** PWA manifest (Stage 155.3 / 169.4): runtime SSOT — getSiteDisplayName(); install prompt — hooks/use-pwa-install.js */
export default function manifest() {
  const brand = getSiteDisplayName()
  const short = brand.length > 12 ? brand.slice(0, 12) : brand
  const defaultName = brand === 'Platform' ? 'Airento' : brand
  const defaultShort = defaultName.length > 12 ? defaultName.slice(0, 12) : defaultName
  return {
    name: `${defaultName} — Rentals Worldwide`,
    short_name: defaultShort,
    description: `Rent villas, cars, yachts and tours worldwide. Book with ${defaultName}.`,
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0d9488',
    orientation: 'portrait-primary',
    lang: 'ru',
    dir: 'ltr',
    scope: '/',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
    categories: ['travel', 'lifestyle', 'business'],
    shortcuts: [
      { name: 'Search Listings', short_name: 'Search', description: 'Search for properties', url: '/listings' },
      { name: 'My Bookings', short_name: 'Bookings', description: 'View your bookings', url: '/my-bookings' },
      { name: 'Messages', short_name: 'Chat', description: 'View your messages', url: '/messages/' },
    ],
  }
}
