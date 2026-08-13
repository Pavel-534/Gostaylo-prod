'use client'

import { useEffect, useState } from 'react'

/**
 * Stage 200.134 — visualViewport frame for mobile overlays (keyboard / iOS chrome).
 * Prefer this over raw `100vh`/`dvh` for dialog max-height and bottom-sheet pinning.
 */
export function useVisualViewportFrame() {
  const [frame, setFrame] = useState({
    heightPx: null,
    offsetTop: 0,
    bottomInset: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const sync = () => {
      const vv = window.visualViewport
      if (!vv) {
        setFrame({ heightPx: null, offsetTop: 0, bottomInset: 0 })
        return
      }
      setFrame({
        heightPx: vv.height,
        offsetTop: vv.offsetTop,
        bottomInset: Math.max(0, window.innerHeight - vv.offsetTop - vv.height),
      })
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return frame
}

export default useVisualViewportFrame
