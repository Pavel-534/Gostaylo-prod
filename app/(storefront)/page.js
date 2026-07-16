import { Suspense } from 'react'
import '@/lib/translations/register-listings-public-i18n'
import { MobileSmartInstallBanner } from '@/components/pwa/MobileSmartInstallBanner'
import { HomePageSkeleton } from '@/components/home-page-skeleton'
import { getCachedHomeBootstrap } from '@/lib/listing/get-cached-home-bootstrap.js'
import { buildHomeDehydratedState } from '@/lib/query-prefetch/prefetch-home-queries'
import { HomeHydrationBoundary } from '@/components/home/HomeHydrationBoundary'

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
