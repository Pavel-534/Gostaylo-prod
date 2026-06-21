'use client'

import { useCallback, useEffect, useState } from 'react'
import { WORKSPACE_SCROLL_ATTR } from '@/lib/layout/workspace-shell'

/**
 * Resolve the workspace scrollport from a child node or document.
 * @param {HTMLElement | null | undefined} fromNode
 * @returns {HTMLElement | null}
 */
export function findWorkspaceScrollRoot(fromNode) {
  if (typeof document === 'undefined') return null

  let el = fromNode?.parentElement ?? null
  while (el) {
    if (el.hasAttribute(WORKSPACE_SCROLL_ATTR)) return el
    el = el.parentElement
  }

  return document.querySelector(`[${WORKSPACE_SCROLL_ATTR}]`)
}

/**
 * SSOT scroll trigger for liquid compact headers inside partner/admin workspace.
 *
 * Listens to scroll on the nearest `[data-workspace-scroll]` ancestor (WORKSPACE_SCROLL_CLASS).
 *
 * @param {{ threshold?: number, enabled?: boolean }} [options]
 * @returns {{ isScrolled: boolean, scrollTop: number, anchorRef: (node: HTMLElement | null) => void }}
 */
export function useWorkspaceScrollTrigger(options = {}) {
  const { threshold = 20, enabled = true } = options
  const [anchorEl, setAnchorEl] = useState(null)
  const anchorRef = useCallback((node) => {
    setAnchorEl(node)
  }, [])
  const [isScrolled, setIsScrolled] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !anchorEl) return undefined

    const root = findWorkspaceScrollRoot(anchorEl)
    if (!root) return undefined

    const onScroll = () => {
      const top = root.scrollTop
      setScrollTop(top)
      setIsScrolled(top > threshold)
    }

    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [enabled, threshold, anchorEl])

  return { isScrolled, scrollTop, anchorRef }
}

export default useWorkspaceScrollTrigger
