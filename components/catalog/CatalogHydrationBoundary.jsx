'use client'

/**
 * Client bridge: server-dehydrated TanStack Query cache → catalog composer.
 * Stage 171.26 (P0.2)
 */

import { HydrationBoundary } from '@tanstack/react-query'
import ListingsCatalogClient from '@/app/(storefront)/listings/listings-catalog-client'

/**
 * @param {object} props
 * @param {import('@tanstack/react-query').DehydratedState} props.state
 * @param {import('react').ReactNode} [props.children]
 */
export function CatalogHydrationBoundary({ state, children }) {
  return (
    <HydrationBoundary state={state}>
      {children ?? <ListingsCatalogClient />}
    </HydrationBoundary>
  )
}
