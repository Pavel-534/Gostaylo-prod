'use client'

/**
 * ADR-102 — Draft lifecycle for catalog extra filters (dialog / bottom-sheet).
 * URL SSOT: parent commits via onCommit; draft never writes URL directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cloneExtraFilters, defaultExtraFilters } from '@/lib/search/listings-page-url'

/**
 * @param {{
 *   committed: import('@/lib/search/listings-page-url.js').ListingsExtraFilters,
 *   onCommit: (next: import('@/lib/search/listings-page-url.js').ListingsExtraFilters) => void,
 *   open?: boolean,
 * }} options
 */
export function useCatalogExtraFiltersDraft({ committed, onCommit, open = false }) {
  const [draftExtraFilters, setDraftExtraFilters] = useState(() => cloneExtraFilters(committed))
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftExtraFilters(cloneExtraFilters(committed))
    }
    wasOpenRef.current = open
  }, [open, committed])

  const onChange = useCallback((updater) => {
    setDraftExtraFilters((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  const applyDraft = useCallback(() => {
    onCommit(cloneExtraFilters(draftExtraFilters))
  }, [draftExtraFilters, onCommit])

  const resetDraft = useCallback(() => {
    setDraftExtraFilters(defaultExtraFilters())
  }, [])

  const discardDraft = useCallback(() => {
    setDraftExtraFilters(cloneExtraFilters(committed))
  }, [committed])

  return {
    draftExtraFilters,
    setDraftExtraFilters: onChange,
    applyDraft,
    resetDraft,
    discardDraft,
  }
}

export default useCatalogExtraFiltersDraft
