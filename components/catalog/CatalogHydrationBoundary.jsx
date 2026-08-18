'use client'

/**
 * Client bridge: server-dehydrated TanStack Query cache → catalog composer.
 * Stage 171.26 (P0.2)
 */

import { HydrationBoundary } from '@tanstack/react-query'

/**
 * Hydrates TanStack cache around the catalog composer (Stage 201.103).
 *
 * @param {object} props
 * @param {import('@tanstack/react-query').DehydratedState} props.state
 * @param {import('react').ReactNode} [props.children]
 */
export function CatalogHydrationBoundary({ state, children }) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>
}
