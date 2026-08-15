'use client'

/**
 * Stage 201.46 — Sheet/Dialog `Content` stays in the React tree while closed
 * (Radix only portals DOM when open). Dock lock must follow the Root `open`
 * flag, not Content mount. Shared context for Sheet + Dialog wrappers.
 */

import * as React from 'react'

const OverlayOpenContext = React.createContext(false)

export function OverlayOpenProvider({ open, children }) {
  return (
    <OverlayOpenContext.Provider value={Boolean(open)}>
      {children}
    </OverlayOpenContext.Provider>
  )
}

export function useOverlayOpen() {
  return React.useContext(OverlayOpenContext)
}

/**
 * Mirror controlled/uncontrolled open for Radix Root so Content can lock the dock
 * only while the overlay is actually open.
 */
export function useMirroredOpenState({ open, defaultOpen = false, onOpenChange }) {
  const isControlled = open !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(Boolean(defaultOpen))
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(Boolean(next))
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  return { resolvedOpen, isControlled, handleOpenChange }
}
