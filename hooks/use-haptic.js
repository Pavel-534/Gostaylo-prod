'use client'

import { useCallback, useMemo } from 'react'

const PRESETS = {
  light: 10,
  medium: 20,
  success: [10, 30, 20],
  error: [30, 50, 30],
}

function canVibrate() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * SSR-safe haptic feedback via `navigator.vibrate` (Stage 200.67).
 * No-ops when Vibration API is unavailable (desktop / iOS Safari / SSR).
 *
 * @returns {{
 *   supported: boolean,
 *   trigger: (pattern?: keyof typeof PRESETS | number | number[]) => void,
 *   light: () => void,
 *   medium: () => void,
 *   success: () => void,
 *   error: () => void,
 * }}
 */
export function useHaptic() {
  const supported = useMemo(() => canVibrate(), [])

  const trigger = useCallback((pattern = 'light') => {
    if (!canVibrate()) return
    const resolved = typeof pattern === 'string' ? PRESETS[pattern] ?? PRESETS.light : pattern
    try {
      navigator.vibrate(resolved)
    } catch {
      /* ignore unsupported / blocked */
    }
  }, [])

  return useMemo(
    () => ({
      supported,
      trigger,
      light: () => trigger('light'),
      medium: () => trigger('medium'),
      success: () => trigger('success'),
      error: () => trigger('error'),
    }),
    [supported, trigger],
  )
}

export default useHaptic
