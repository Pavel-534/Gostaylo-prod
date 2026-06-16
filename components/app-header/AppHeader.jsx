'use client'

/**
 * AppHeader — SSOT header для всего приложения (white-label через getSiteDisplayName).
 *
 * Три режима (автодетект по pathname, override через prop variant):
 *   • public    → /, /listings, /help, /about, /u/* — glass-white, hero-aware
 *   • workspace → /renter, /partner, /admin, /settings — solid-white + menu toggle
 *   • chat      → /messages/* — slim, минимальный (этап 4)
 *
 * Dynamic spacing: ResizeObserver записывает высоту <header> в
 * CSS custom property `--app-header-height` на <html>. Это покрывает
 * переменную высоту когда активен AdminImpersonationStripe (~28px + 65px).
 * MainContent читает этот var для pt-[var(--app-header-height)].
 *
 * Shadow recipe: единый воздушный border + teal-tinted shadow.
 * Scroll-progress: 2px teal gradient в bottom border.
 *
 * @created 2026-02-05 Unified Header Sprint
 * @updated 2026-02-05 Step 3 — UserMenuDropdown split + dynamic spacing + scroll progress
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Home as HomeIcon } from 'lucide-react'
import { CurrencySelector } from '@/components/currency-selector'
import { HeaderWalletCompact } from '@/components/wallet/HeaderWalletCompact'
import { AirentoLogo } from '@/components/brand/airento-logo'
import { LangSwitcher } from '@/components/app-header/LangSwitcher'
import { AdminImpersonationStripe } from '@/components/app-header/AdminImpersonationStripe'
import { UserMenuDropdown } from '@/components/app-header/UserMenuDropdown'
import { ScrollProgressBar } from '@/components/app-header/ScrollProgressBar'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'

/** Определить variant из pathname */
function detectVariant(pathname) {
  if (!pathname) return 'public'
  if (pathname.startsWith('/messages')) return 'chat'
  if (
    pathname.startsWith('/renter') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile')
  ) return 'workspace'
  return 'public'
}

/** Контекстный заголовок workspace страницы (fallback когда нет centerSlot) */
function getWorkspaceTitle(pathname, language) {
  if (!pathname) return null
  const t = (ru, en) => (language === 'ru' ? ru : en)
  if (pathname.startsWith('/my-bookings') || pathname.startsWith('/renter/bookings')) return t('Мои бронирования', 'My Bookings')
  if (pathname.startsWith('/renter/favorites')) return t('Избранное', 'Favorites')
  if (pathname.startsWith('/renter/profile')) return t('Профиль', 'Profile')
  if (pathname.startsWith('/renter/dashboard')) return t('Панель арендатора', 'Renter Dashboard')
  if (pathname.startsWith('/renter/settings')) return t('Настройки', 'Settings')
  if (pathname.startsWith('/renter')) return t('Личный кабинет', 'My Account')
  if (pathname.startsWith('/partner/finances')) return t('Финансы', 'Finances')
  if (pathname.startsWith('/partner/listings')) return t('Мои объявления', 'My Listings')
  if (pathname.startsWith('/partner/calendar')) return t('Календарь', 'Calendar')
  if (pathname.startsWith('/partner')) return t('Панель партнёра', 'Partner Dashboard')
  if (pathname.startsWith('/admin')) return t('Админ-панель', 'Admin')
  if (pathname.startsWith('/settings')) return t('Настройки', 'Settings')
  return null
}

const PUBLIC_NAV = [
  { href: '/listings', key: 'navListings' },
  { href: '/listings?group=destinations', key: 'navDestinations' },
  { href: '/profile/referral', key: 'navMembership' },
  { href: '/help', key: 'navHelp' },
]

export function AppHeader({
  variant: variantOverride,
  centerSlot,
  onMenuClick,
  showMenuButton = true,
}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef(null)

  const { language } = useI18n()
  const { currency, setCurrency } = useCurrency()
  const { user } = useAuth()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Dynamic height → --app-header-height (покрывает impersonation stripe, вариации padding)
  useEffect(() => {
    if (!headerRef.current) return
    const el = headerRef.current
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--app-header-height', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [mounted, user?.is_impersonating, pathname])

  if (!mounted) return null

  // Root-level header does not own workspace shells.
  if (!variantOverride && pathname && (
    pathname.startsWith('/renter') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/admin')
  )) {
    return null
  }

  const variant = variantOverride || detectVariant(pathname)
  if (variant === 'chat') return null

  const isPublic = variant === 'public'
  const isWorkspace = variant === 'workspace'
  const workspaceTitle = isWorkspace && !centerSlot ? getWorkspaceTitle(pathname, language) : null
  const logoLabel = isWorkspace ? '' : getSiteDisplayName()

  return (
    <header
      ref={headerRef}
      data-testid={`app-header-${variant}`}
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] transition-all duration-300',
        isPublic && 'border-b border-slate-200/80 backdrop-blur-md shadow-sm shadow-brand/10',
        isWorkspace && 'border-b border-slate-200 bg-white',
      )}
      style={
        isPublic
          ? {
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,249,251,0.92) 100%)',
            }
          : undefined
      }
    >
      <AdminImpersonationStripe />

      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">

          {/* LEFT */}
          <div className="flex items-center gap-2 min-w-0">
            {isWorkspace && showMenuButton && (
              <button
                type="button"
                onClick={onMenuClick}
                aria-label="Menu"
                data-testid="app-header-menu-btn"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <Link
              href="/"
              data-testid="app-header-logo"
              className={cn(
                'group flex-shrink-0 rounded-2xl px-2.5 py-1.5 transition-all',
                isPublic && 'border border-white/70 bg-white/75 shadow-[0_10px_26px_rgba(0,102,102,0.1)] backdrop-blur-md hover:border-brand/35 hover:shadow-[0_14px_30px_rgba(0,102,102,0.16)]',
                isWorkspace && 'hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-3">
                <AirentoLogo
                  compact
                  label={logoLabel}
                  scrolled={scrolled}
                  hideLabelOnMobile={isPublic}
                />
                {isPublic && (
                  <>
                    <span className="hidden sm:block h-8 w-px bg-slate-200" />
                    <span className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      super-app
                    </span>
                  </>
                )}
                {isWorkspace && (
                  <span
                    className={cn(
                      'hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
                      pathname?.startsWith('/admin') && 'bg-indigo-50 text-indigo-700',
                      pathname?.startsWith('/partner') && 'bg-brand/10 text-brand',
                      (!pathname?.startsWith('/admin') && !pathname?.startsWith('/partner')) && 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {pathname?.startsWith('/admin') ? 'Admin' : pathname?.startsWith('/partner') ? 'Partner' : 'Renter'}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* CENTER */}
          {isPublic && (
            <nav className="hidden lg:flex flex-1 items-center gap-6">
              {PUBLIC_NAV.map((item, idx) => {
                // Извлекаем query group для точного active-detection
                const [itemPath, itemQuery] = item.href.split('?')
                const hasDestQuery = itemQuery?.includes('group=destinations')

                let active = false
                if (item.href === '/profile/referral') {
                  active = pathname?.startsWith('/profile/referral')
                } else if (item.href === '/help') {
                  active = pathname?.startsWith('/help')
                } else if (itemPath === '/listings') {
                  const onListings = pathname === '/listings' || pathname?.startsWith('/listings/')
                  if (hasDestQuery) {
                    active = onListings && typeof window !== 'undefined' && window.location.search.includes('group=destinations')
                  } else {
                    active = onListings && !(typeof window !== 'undefined' && window.location.search.includes('group=destinations'))
                  }
                }
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    data-testid={`app-header-nav-${item.key}`}
                    className={cn(
                      'text-sm font-medium transition-colors pb-1',
                      active ? 'text-brand border-b-2 border-brand' : 'text-slate-600 hover:text-brand',
                    )}
                  >
                    {getUIText(item.key, language)}
                  </Link>
                )
              })}
            </nav>
          )}

          {isWorkspace && (
            <div className="flex-1 min-w-0 flex items-center justify-center">
              {centerSlot || (workspaceTitle && (
                <span
                  data-testid="app-header-workspace-title"
                  className="hidden md:inline-block truncate text-sm font-semibold text-slate-700"
                >
                  {workspaceTitle}
                </span>
              ))}
            </div>
          )}

          {/* RIGHT */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isWorkspace && (
              <Link
                href="/"
                aria-label={getUIText('partnerLayout_backToSiteAria', language) || 'Home'}
                data-testid="app-header-home-link"
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand"
              >
                <HomeIcon className="h-4 w-4" />
              </Link>
            )}

            <div className="shrink-0">
              <LangSwitcher size={isWorkspace ? 'compact' : 'default'} />
            </div>
            <div className="shrink-0">
              <CurrencySelector
                value={currency}
                onChange={setCurrency}
                compact={isWorkspace}
                className={isWorkspace ? 'px-1.5 sm:px-2' : ''}
              />
            </div>

            {user ? <div className={cn(isWorkspace && 'hidden sm:block')}><HeaderWalletCompact /></div> : null}

            <UserMenuDropdown />
          </div>
        </div>
      </div>

      {/* Premium scroll progress (2px teal gradient) */}
      <ScrollProgressBar />
    </header>
  )
}

export default AppHeader
