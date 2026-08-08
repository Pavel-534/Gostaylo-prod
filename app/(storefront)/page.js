import { Suspense } from 'react'
import '@/lib/translations/register-listings-public-i18n'
import { MobileSmartInstallBanner } from '@/components/pwa/MobileSmartInstallBanner'
import { HomePageSkeleton } from '@/components/home-page-skeleton'
import { getCachedHomeBootstrap } from '@/lib/listing/get-cached-home-bootstrap.js'
import { buildHomeDehydratedState } from '@/lib/query-prefetch/prefetch-home-queries'
import { HomeHydrationBoundary } from '@/components/home/HomeHydrationBoundary'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { buildOgImageMetadata } from '@/lib/seo/resolve-og-image.js'

/**
 * Stage 200.71 — home-only canonical on apex (do not set on root layout — would leak to all routes).
 */
export async function generateMetadata() {
  const apex = getPublicSiteUrl().replace(/\/$/, '')
  const canonical = `${apex}/`
  const brand = getSiteDisplayName()
  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)
  const title =
    lang === 'ru' ? `${brand} — аренда по всему миру` : `${brand} - Rentals Worldwide`
  const description =
    lang === 'ru'
      ? `${brand} — бронирование жилья, транспорта, яхт и туров с онлайн-предоплатой и защитой эскроу до заселения.`
      : `${brand} — book homes, transport, yachts and tours with secure online prepayment and escrow until check-in.`
  const ogDescription =
    lang === 'ru'
      ? `Аренда с онлайн-бронированием и безопасной предоплатой (эскроу).`
      : `Rentals with online booking and secure prepayment (escrow).`

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: ogDescription,
      url: canonical,
      siteName: brand,
      type: 'website',
      images: buildOgImageMetadata(null, apex, title),
    },
  }
}

/**
 * Home RSC shell — server bootstrap + TanStack dehydrate + client composer.
 * Stage 171.27 — categories + featured hydrate; cold load skips client GET for both.
 */

export default async function Page() {
  const bootstrap = await getCachedHomeBootstrap()
  const dehydratedState = await buildHomeDehydratedState(bootstrap)

  return (
    <>
      <MobileSmartInstallBanner />
      <Suspense fallback={<HomePageSkeleton />}>
        <HomeHydrationBoundary state={dehydratedState} />
      </Suspense>
    </>
  )
}
