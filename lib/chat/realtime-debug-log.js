/**
 * Логи Realtime в production: в консоли браузера выполните:
 *   localStorage.setItem('GOSTAYLO_RT_DEBUG','1'); location.reload()
 * В development логи включены без флага.
 */
export function isRealtimeDebugEnabled() {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV === 'development') return true
  try {
    return window.localStorage?.getItem('GOSTAYLO_RT_DEBUG') === '1'
  } catch {
    return false
  }
}
