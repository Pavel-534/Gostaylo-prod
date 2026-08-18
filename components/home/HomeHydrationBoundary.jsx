'use client'

/**
 * Client bridge: server-dehydrated TanStack Query cache → home composer.
 * Stage 171.27
 */

import { HydrationBoundary } from '@tanstack/react-query'

/**
 * Hydrates TanStack cache around the home composer (Stage 201.103).
 *
 * @param {object} props
 * @param {import('@tanstack/react-query').DehydratedState} props.state
 * @param {import('react').ReactNode} [props.children]
 */
export function HomeHydrationBoundary({ state, children }) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>
}
