'use client'

import { useContext, useEffect, useRef } from 'react'
import AuthContext from '@/contexts/auth-context'

/** @typedef {'success' | 'dismiss'} AuthModalCloseOutcome */

/**
 * Stage 139.1 — consumer hook for auth modal state machine.
 * Subscribe to close outcomes via `onClose(outcome)`.
 *
 * @param {{ onClose?: (outcome: AuthModalCloseOutcome) => void }} [options]
 */
export function useAuthModalState(options = {}) {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthModalState must be used within AuthProvider')
  }

  const { onClose } = options
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!onClose || typeof ctx.registerAuthModalOnClose !== 'function') return undefined
    return ctx.registerAuthModalOnClose((outcome) => {
      onCloseRef.current?.(outcome)
    })
  }, [ctx.registerAuthModalOnClose, onClose])

  return {
    loginModalOpen: ctx.loginModalOpen,
    openLoginModal: ctx.openLoginModal,
    closeLoginModal: ctx.closeLoginModal,
  }
}
