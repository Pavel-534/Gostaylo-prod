/**
 * Client display channel SSOT — desktop web vs mobile web vs installed PWA.
 * Use for UX that should differ by surface (SW update toast, install prompts, etc.).
 */

import { canShowPwaInstallUi, isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform.js'

/** @typedef {'ssr' | 'desktop-web' | 'mobile-web' | 'installed-pwa'} ClientDisplayChannel */

/**
 * @returns {ClientDisplayChannel}
 */
export function getClientDisplayChannel() {
  if (typeof window === 'undefined') return 'ssr'
  if (isStandaloneDisplayMode()) return 'installed-pwa'
  try {
    if (window.matchMedia('(max-width: 767px)').matches) return 'mobile-web'
  } catch {
    /* ignore */
  }
  return 'desktop-web'
}

/**
 * Branded SW update toast — installed PWA or mobile web (may add to home screen).
 * Desktop browser tabs get silent cache refresh without app-style nag.
 * @returns {boolean}
 */
export function shouldShowSwUpdatePrompt() {
  const channel = getClientDisplayChannel()
  if (channel === 'installed-pwa') return true
  if (channel === 'mobile-web' && canShowPwaInstallUi()) return true
  return false
}

/**
 * PDP desktop bento grid (Airbnb-style) — not collapsed to a single hero banner.
 * @returns {boolean}
 */
export function prefersDesktopWebGalleryLayout() {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(min-width: 768px)').matches
  } catch {
    return false
  }
}
