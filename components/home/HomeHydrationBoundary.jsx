'use client'

/**
 * Client bridge: server-dehydrated TanStack Query cache → home composer.
 * Stage 171.27
 */

import { HydrationBoundary } from '@tanstack/react-query'
import { PlatformHomeContent } from '@/components/PlatformHomeContent'

/**
 * @param {object} props
 * @param {import('@tanstack/react-query').DehydratedState} props.state
 */
export function HomeHydrationBoundary({ state }) {
  return (
    <HydrationBoundary state={state}>
      <PlatformHomeContent />
    </HydrationBoundary>
  )
}
