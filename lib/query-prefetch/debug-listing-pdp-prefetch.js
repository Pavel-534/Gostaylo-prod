/**
 * Dev-only: full PDP bootstrap + dehydrate smoke (server import only).
 * @param {string} listingId
 */
export async function debugListingPdpPrefetchPipeline(listingId) {
  const { getCachedListingPdpBootstrap } = await import(
    '@/lib/listing/get-cached-listing-pdp-bootstrap.js'
  )
  const { buildListingPdpDehydratedState } = await import(
    '@/lib/query-prefetch/prefetch-listing-pdp-queries.js'
  )

  const bootstrap = await getCachedListingPdpBootstrap(listingId)
  const dehydratedState =
    bootstrap.kind === 'ok'
      ? await buildListingPdpDehydratedState(listingId, bootstrap.listing)
      : null

  return { bootstrap, dehydratedState }
}
