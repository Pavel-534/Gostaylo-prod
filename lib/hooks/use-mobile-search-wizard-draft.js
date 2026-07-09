'use client'

/**
 * Stage 178.3 Step 2 — draft lifecycle for MobileSearchWizard (ADR-102 pattern).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cloneMobileSearchWizardDraft } from '@/lib/search/mobile-search-wizard-draft'

/**
 * @param {{
 *   committed: import('@/lib/search/mobile-search-wizard-draft.js').MobileSearchWizardDraft | Record<string, unknown>,
 *   open?: boolean,
 * }} options
 */
export function useMobileSearchWizardDraft({ committed, open = false }) {
  const [draftFilters, setDraftFilters] = useState(() => cloneMobileSearchWizardDraft(committed))
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftFilters(cloneMobileSearchWizardDraft(committed))
    }
    wasOpenRef.current = open
  }, [open, committed])

  const patchDraft = useCallback((patch) => {
    setDraftFilters((prev) => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }))
  }, [])

  const discardDraft = useCallback(() => {
    setDraftFilters(cloneMobileSearchWizardDraft(committed))
  }, [committed])

  return {
    draftFilters,
    setDraftFilters,
    patchDraft,
    discardDraft,
  }
}
