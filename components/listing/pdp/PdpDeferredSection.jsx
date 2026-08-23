'use client'

/**
 * Stage 201.118 — viewport-gated mount for PDP below-the-fold sections.
 * Reuses Stage 171.23 `useElementInView` (+ tighter margin on constrained networks).
 */

import { useNetworkQuality } from '@/hooks/use-network-quality'
import { useElementInView } from '@/hooks/use-element-in-view'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   fallback?: import('react').ReactNode,
 *   rootMargin?: string,
 *   className?: string,
 *   once?: boolean,
 * }} props
 */
export function PdpDeferredSection({
  children,
  fallback = null,
  rootMargin,
  className,
  once = true,
}) {
  const networkQuality = useNetworkQuality()
  const margin =
    rootMargin ?? (networkQuality.constrained ? '80px 0px' : '300px 0px')
  const { ref, inView } = useElementInView({
    rootMargin: margin,
    threshold: networkQuality.constrained ? 0.12 : 0.01,
    once,
  })

  return (
    <div ref={ref} className={cn(className)}>
      {inView ? children : fallback}
    </div>
  )
}
