'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Intersection Observer — lazy mount maps, rails, etc. (Stage 171.23).
 * @param {{ rootMargin?: string, threshold?: number, once?: boolean }} [options]
 */
export function useElementInView(options = {}) {
  const { rootMargin = '0px', threshold = 0.1, once = true } = options
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once])

  return { ref, inView }
}
