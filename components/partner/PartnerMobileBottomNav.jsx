/**
 * Stage 194.0-A — Partner cabinet mobile bottom nav (lg:hidden).
 *
 * Separate from storefront `MobileBottomNav` (which skips `/partner`).
 * Reuses ADR-100 `--app-bottom-nav-height` + `.safe-area-pb` so workspace frame
 * clears the dock without duplicating measurement logic.
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Inbox,
  MoreHorizontal,
} from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import {
  PARTNER_NAV_PREFETCH_PATHS,
  matchesOptimisticNavHref,
  useOptimisticNavHref,
} from '@/hooks/use-optimistic-nav-href'

const KEYBOARD_VIEWPORT_SHRINK_PX = 120

const PRIMARY_TABS = [
  {
    id: 'dashboard',
    href: '/partner/dashboard',
    icon: LayoutDashboard,
    labelKey: 'partnerNav_dashboard',
    match: (p) => p === '/partner' || p === '/partner/dashboard' || p.startsWith('/partner/dashboard/'),
  },
  {
    id: 'listings',
    href: '/partner/listings',
    icon: Briefcase,
    labelKey: 'partnerNav_listings',
    match: (p) => p === '/partner/listings' || p.startsWith('/partner/listings/'),
  },
  {
    id: 'calendar',
    href: '/partner/calendar',
    icon: Calendar,
    labelKey: 'partnerNav_calendar',
    match: (p) => p === '/partner/calendar' || p.startsWith('/partner/calendar/'),
  },
  {
    id: 'bookings',
    href: '/partner/bookings',
    icon: Inbox,
    labelKey: 'partnerNav_bookings',
    match: (p) => p === '/partner/bookings' || p.startsWith('/partner/bookings/'),
  },
]

/** Secondary IA — highlighted on «More» when user is outside primary tabs. */
const MORE_ACTIVE_PREFIXES = [
  '/partner/finances',
  '/partner/payout-profiles',
  '/partner/promo',
  '/partner/settings',
  '/partner/reviews',
  '/partner/referrals',
  '/profile/referral',
  '/messages',
]

function isMoreRouteActive(pathname) {
  if (!pathname) return false
  return MORE_ACTIVE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function shouldRenderPartnerBottomNav(pathname) {
  if (!pathname?.startsWith('/partner')) return false
  // Listing wizard owns bottom chrome (Stage 171.8 / 194.0-A).
  if (/^\/partner\/listings\/(new|[^/]+)$/.test(pathname)) return false
  return true
}

/**
 * @param {{ language?: string, onMoreClick?: () => void }} props
 */
export function PartnerMobileBottomNav({ language = 'ru', onMoreClick }) {
  const [mounted, setMounted] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const navRef = useRef(null)
  const pathname = usePathname()
  const { pendingHref, markPending } = useOptimisticNavHref({
    prefetchPaths: PARTNER_NAV_PREFETCH_PATHS,
  })

  const routeAllowsNav = useMemo(
    () => mounted && shouldRenderPartnerBottomNav(pathname),
    [mounted, pathname],
  )
  const navVisible = routeAllowsNav && !keyboardOpen

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncKeyboard = () => {
      const vv = window.visualViewport
      if (!vv) {
        setKeyboardOpen(false)
        return
      }
      const shrink = window.innerHeight - vv.height
      setKeyboardOpen(shrink > KEYBOARD_VIEWPORT_SHRINK_PX)
    }

    syncKeyboard()
    const vv = window.visualViewport
    vv?.addEventListener('resize', syncKeyboard)
    vv?.addEventListener('scroll', syncKeyboard)
    window.addEventListener('focusin', syncKeyboard)
    window.addEventListener('focusout', syncKeyboard)

    return () => {
      vv?.removeEventListener('resize', syncKeyboard)
      vv?.removeEventListener('scroll', syncKeyboard)
      window.removeEventListener('focusin', syncKeyboard)
      window.removeEventListener('focusout', syncKeyboard)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (!navVisible || !navRef.current) {
      root.style.setProperty('--app-bottom-nav-height', '0px')
      return undefined
    }
    const el = navRef.current
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      root.style.setProperty('--app-bottom-nav-height', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--app-bottom-nav-height', '0px')
    }
  }, [navVisible, pathname])

  if (!navVisible) return null

  const moreActive = isMoreRouteActive(pathname)
  const primaryActiveId = PRIMARY_TABS.find((tab) => tab.match(pathname || ''))?.id ?? null
  const pendingTabId = PRIMARY_TABS.find((tab) => matchesOptimisticNavHref(pendingHref, tab.href))?.id ?? null

  return (
    <nav
      ref={navRef}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-t-2xl shadow-[0_-4px_12px_rgba(0,102,102,0.04)] safe-area-pb"
      aria-label={getUIText('partnerNav_mobileAria', language)}
      data-testid="partner-mobile-bottom-nav"
    >
      <div className="flex h-16 items-center justify-around px-1 min-[375px]:h-20 min-[375px]:px-2">
        {PRIMARY_TABS.map((tab) => {
          const active = primaryActiveId === tab.id || pendingTabId === tab.id
          const Icon = tab.icon
          return (
            <Link
              key={tab.id}
              href={tab.href}
              data-testid={`partner-nav-${tab.id}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => markPending(tab.href)}
              className={cn(
                'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center rounded-xl touch-manipulation transition-colors duration-150',
                'active:scale-[0.97] active:bg-brand/10',
                active
                  ? 'text-brand bg-brand/10 shadow-[inset_0_0_0_1px_rgba(0,102,102,0.12)]'
                  : 'text-slate-400 hover:text-slate-600',
              )}
            >
              <Icon className={cn('h-5 w-5', active ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
              <span className={cn('mt-0.5 max-w-full truncate px-0.5 text-[10px]', active ? 'font-semibold' : 'font-medium')}>
                {getUIText(tab.labelKey, language)}
              </span>
            </Link>
          )
        })}

        <button
          type="button"
          data-testid="partner-nav-more"
          aria-label={getUIText('partnerNav_moreAria', language)}
          onClick={() => onMoreClick?.()}
          className={cn(
            'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center rounded-xl touch-manipulation transition-colors duration-150',
            'active:scale-[0.97] active:bg-brand/10',
            moreActive
              ? 'text-brand bg-brand/10 shadow-[inset_0_0_0_1px_rgba(0,102,102,0.12)]'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          <MoreHorizontal className={cn('h-5 w-5', moreActive ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
          <span className={cn('mt-0.5 text-[10px]', moreActive ? 'font-semibold' : 'font-medium')}>
            {getUIText('partnerNav_more', language)}
          </span>
        </button>
      </div>
    </nav>
  )
}

export default PartnerMobileBottomNav
