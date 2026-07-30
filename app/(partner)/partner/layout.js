/**
 * GoStayLo - Partner Dashboard Layout (World-Class UX)
 * 
 * Features:
 * - Professional sidebar with universal business icons
 * - Collapsible drawer on mobile (hamburger menu)
 * - Breadcrumbs navigation
 * - "+ Create Listing" button
 * - TanStack Query for reactive state management
 * - Future-ready for Firebase push notifications
 * 
 * @updated 2026-03-13 - Added TanStack Query Provider
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useChatUnreadBadge } from '@/lib/context/ChatUnreadBadgeContext'
import { HeaderWalletCompact } from '@/components/wallet/HeaderWalletCompact'
import { AppHeader } from '@/components/app-header/AppHeader'
import { useAuth } from '@/contexts/auth-context'
import { 
  LayoutDashboard,
  Briefcase,
  Calendar,
  Inbox,
  MessageSquare,
  Banknote,
  Wallet,
  Settings,
  LogOut,
  X,
  Home,
  ChevronRight,
  Plus,
  Shield,
  LogIn,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Tag,
  Gift,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolveAvatarDisplaySrc } from '@/lib/image-display-url'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'
import { PartnerNotificationProvider } from '@/contexts/partner-notification-context'
import { PartnerNotificationFeed } from '@/components/partner/PartnerNotificationFeed'
import { PartnerMobileBottomNav } from '@/components/partner/PartnerMobileBottomNav'
import { prefetchPartnerWorkspace } from '@/hooks/use-partner-dashboard-nav'
import {
  PARTNER_SIDEBAR_PREFETCH_PATHS,
  matchesOptimisticNavHref,
  useOptimisticNavHref,
} from '@/hooks/use-optimistic-nav-href'
import {
  WORKSPACE_FRAME_CLASS,
  WORKSPACE_MAIN_CLASS,
  WORKSPACE_MOBILE_TOOLBAR_CLASS,
  WORKSPACE_SCROLL_CLASS,
  WORKSPACE_SCROLL_ATTR,
  WORKSPACE_SIDEBAR_CLASS,
  WORKSPACE_TOOLBAR_CLASS,
  WORKSPACE_TOOLBAR_ROW_CLASS,
} from '@/lib/layout/workspace-shell'

const PartnerForegroundNotifications = dynamic(
  () =>
    import('@/components/partner/PartnerForegroundNotifications').then((m) => ({
      default: m.PartnerForegroundNotifications,
    })),
  { ssr: false },
)

const SIDEBAR_CONFIG = [
  { nameKey: 'partnerNav_dashboard', href: '/partner/dashboard', icon: LayoutDashboard, descKey: 'partnerNav_dashboardDesc' },
  { nameKey: 'partnerNav_listings', href: '/partner/listings', icon: Briefcase, descKey: 'partnerNav_listingsDesc' },
  { nameKey: 'partnerNav_promo', href: '/partner/promo', icon: Tag, descKey: 'partnerNav_promoDesc' },
  { nameKey: 'partnerNav_referral', href: '/profile/referral', icon: Gift, descKey: 'partnerNav_referralDesc' },
  { nameKey: 'partnerNav_calendar', href: '/partner/calendar', icon: Calendar, descKey: 'partnerNav_calendarDesc' },
  { nameKey: 'partnerNav_bookings', href: '/partner/bookings', icon: Inbox, descKey: 'partnerNav_bookingsDesc' },
  { nameKey: 'partnerNav_reviews', href: '/partner/reviews', icon: Star, descKey: 'partnerNav_reviewsDesc' },
  { nameKey: 'partnerNav_messages', href: '/messages', icon: MessageSquare, descKey: 'partnerNav_messagesDesc', badge: null },
  { nameKey: 'partnerNav_finances', href: '/partner/finances', icon: Banknote, descKey: 'partnerNav_financesDesc' },
  { nameKey: 'partnerNav_payoutProfiles', href: '/partner/payout-profiles', icon: Wallet, descKey: 'partnerNav_payoutProfilesDesc' },
  { nameKey: 'partnerNav_settings', href: '/partner/settings', icon: Settings, descKey: 'partnerNav_settingsDesc' },
]

export default function PartnerLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { totalUnread } = useChatUnreadBadge()
  const [language, setLanguage] = useState('ru')
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth()
  const { pendingHref, markPending } = useOptimisticNavHref({
    prefetchPaths: PARTNER_SIDEBAR_PREFETCH_PATHS,
  })
  const isImpersonating = user?.is_impersonating === true
  const allowedRoles = ['PARTNER', 'ADMIN', 'MODERATOR']
  const accessDenied = !authLoading && (!isAuthenticated || !allowedRoles.includes(String(user?.role || '').toUpperCase()))
  const isNotLoggedIn = !authLoading && !isAuthenticated
  const isListingWizardRoute = /^\/partner\/listings\/(new|[^/]+)$/.test(pathname || '')

  useEffect(() => {
    const initial = detectLanguage()
    setLanguage(initial)
    persistLanguage(initial)
    if (typeof document !== 'undefined') document.documentElement.lang = initial
    const handleLang = (e) => {
      const next = e?.detail
      if (!next) return
      setLanguage(next)
      persistLanguage(next)
      document.documentElement.lang = next
    }
    window.addEventListener('language-change', handleLang)
    window.addEventListener('languageChange', handleLang)
    return () => {
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
  }, [])

  const sidebarItems = useMemo(
    () =>
      SIDEBAR_CONFIG.map((item) => ({
        ...item,
        name: getUIText(item.nameKey, language),
        description: getUIText(item.descKey, language),
      })),
    [language],
  )

  useEffect(() => {
    prefetchPartnerWorkspace(router)
  }, [router])

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024)
    }
  }, [])

  // Generate breadcrumbs from pathname
  const breadcrumbs = useMemo(() => {
    if (!pathname) return []
    
    const segments = pathname.split('/').filter(Boolean)
    const crumbs = []
    let currentPath = ''
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // Skip UUID-like segments for cleaner breadcrumbs
      const isUUID = segment.match(/^[a-z]+-[a-z0-9]+-[a-z0-9]+$/i) || segment.match(/^lst-/)
      
      const crumbKey = !isUUID && segment ? `partnerBreadcrumb_${segment}` : null
      const label = isUUID
        ? getUIText('partnerBreadcrumb_details', language)
        : crumbKey && getUIText(crumbKey, language) !== crumbKey
          ? getUIText(crumbKey, language)
          : segment
      crumbs.push({
        name: label,
        href: currentPath,
        isLast: index === segments.length - 1
      })
    })

    crumbs.forEach((c, i) => {
      c.isLast = i === crumbs.length - 1
    })

    return crumbs
  }, [pathname, language])

  // Handlers
  const handleLoginRedirect = () => {
    sessionStorage.setItem('gostaylo_redirect_after_login', pathname)
    router.push('/profile?login=true')
  }

  const handleReturnToAdmin = () => router.push('/admin/users')
  const handleLogout = () => logout()

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand mx-auto mb-3"></div>
          <p className="text-slate-500 text-sm">{getUIText('loading', language)}</p>
        </div>
      </div>
    )
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Shield className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {isNotLoggedIn ? getUIText('partnerLayout_authRequired', language) : getUIText('partnerLayout_accessLimited', language)}
          </h1>
          <p className="text-slate-500 mb-6">
            {isNotLoggedIn 
              ? getUIText('partnerLayout_signInBody', language) 
              : getUIText('partnerLayout_partnersOnly', language)}
          </p>
          <div className="space-y-3">
            {isNotLoggedIn ? (
              <>
                <Button 
                  onClick={handleLoginRedirect}
                  className="bg-brand hover:bg-brand-hover w-full"
                  data-testid="access-denied-login-btn"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {getUIText('partnerLayout_signInCta', language)}
                </Button>
                <p className="text-xs text-slate-400">
                  {getUIText('partnerLayout_redirectAfterLogin', language)}
                </p>
              </>
            ) : (
              <Button asChild className="bg-brand hover:bg-brand-hover w-full">
                <Link href="/profile" data-testid="access-denied-become-partner-btn">
                  {getUIText('partnerLayout_becomePartner', language)}
                </Link>
              </Button>
            )}
            <Button variant="ghost" asChild className="w-full">
              <Link href="/">{getUIText('partnerLayout_home', language)}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PartnerNotificationProvider>
      <PartnerForegroundNotifications />
      <div className="min-h-screen bg-brand-surface flex flex-col">
      <AppHeader
        variant="workspace"
        onMenuClick={() => setSidebarOpen((v) => !v)}
      />

      {/* Workspace — fixed below AppHeader (SSOT: workspace-shell.js) */}
      <div className={WORKSPACE_FRAME_CLASS}>
        {/* Mobile backdrop — inside frame so z-50 sidebar stacks above z-40 (not under viewport overlay). */}
        {sidebarOpen ? (
          <div
            className="fixed inset-x-0 bottom-0 top-[var(--app-header-height,64px)] z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        ) : null}

        {/* Sidebar */}
        <aside
          data-testid="partner-workspace-sidebar"
          data-open={sidebarOpen ? 'true' : 'false'}
          className={`${WORKSPACE_SIDEBAR_CLASS} ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } border-r border-slate-200 bg-white shadow-lg max-lg:backdrop-blur-none lg:bg-white/95 lg:backdrop-blur-sm lg:shadow-sm lg:shadow-brand/5`}
        >
          {/* Stage 200.11 — dense chrome: profile + close in one row (no barren X-only strip) */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                {user?.avatar ? (
                  <AvatarImage src={resolveAvatarDisplaySrc(user.avatar) || ''} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand-hover">
                  {user?.name?.[0]?.toUpperCase() || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user?.name || 'Partner'}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden"
                aria-label={getUIText('partnerLayout_closeMenu', language)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2.5">
              <HeaderWalletCompact density="expanded" className="w-full max-w-none justify-between" />
            </div>
          </div>

          <div className="shrink-0 px-3 pt-2.5 pb-1">
            <Button
              asChild
              className="h-11 w-full rounded-2xl shadow-sm"
              variant="brand"
              data-testid="create-listing-btn"
            >
              <Link href="/partner/listings/new" onClick={() => markPending('/partner/listings/new')}>
                <Plus className="mr-2 h-4 w-4" />
                {getUIText('partnerNav_createListing', language)}
              </Link>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              const isMessagesItem = item.href === '/messages'
              const isActive = isMessagesItem
                ? pathname === '/messages' ||
                  pathname?.startsWith('/messages/')
                : pathname === item.href ||
                  (item.href !== '/partner/dashboard' && pathname?.startsWith(item.href))
              const pending = matchesOptimisticNavHref(pendingHref, item.href)
              const active = isActive || pending
              const isMessages = isMessagesItem
              const showUnreadDot = isMessages && totalUnread > 0 && !active

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    markPending(item.href)
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false)
                    }
                  }}
                  className={cn(
                    'group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 transition-colors touch-manipulation',
                    'active:scale-[0.99] active:bg-brand/10',
                    active ? 'gsl-nav-item-active' : 'gsl-nav-item-idle',
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px]',
                        active ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600',
                      )}
                    />
                    {showUnreadDot ? (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={cn('block text-sm', active ? 'font-semibold' : 'font-medium')}>
                      {item.name}
                    </span>
                    <span className="hidden truncate text-[10px] leading-tight text-slate-400 lg:block">
                      {item.description}
                    </span>
                  </div>
                  {isMessages && totalUnread > 0 && !active ? (
                    <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Badge>
                  ) : null}
                  {item.badge && !isMessages ? (
                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                      {item.badge}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </nav>

          {/* Footer — same density/typography as primary nav */}
          <div className="shrink-0 space-y-0.5 border-t border-slate-100 px-2 py-2">
            <Link
              href="/my-bookings"
              onClick={() => {
                markPending('/my-bookings')
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarOpen(false)
                }
              }}
              className="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-brand-hover transition-colors hover:bg-brand/10 touch-manipulation active:scale-[0.99]"
              data-testid="partner-switch-to-guest"
            >
              <CalendarDays className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 leading-snug">{getUIText('partnerNav_switchToGuestMode', language)}</span>
            </Link>
            <Link
              href="/legal/partner-terms/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <Shield className="h-[18px] w-[18px] shrink-0 text-slate-400" />
              <span className="min-w-0 leading-snug">{getUIText('footerPartnerTerms', language)}</span>
            </Link>
            <Link
              href="/"
              onClick={() => markPending('/')}
              className="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 touch-manipulation active:scale-[0.99]"
            >
              <ExternalLink className="h-[18px] w-[18px] shrink-0 text-slate-400" />
              <span className="min-w-0 leading-snug">{getUIText('partnerNav_publicSite', language)}</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span>{getUIText('logout', language)}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={WORKSPACE_MAIN_CLASS}>
          {/* Desktop toolbar */}
          <div className={WORKSPACE_TOOLBAR_CLASS}>
            {/* Impersonation Banner - Desktop */}
            {isImpersonating && (
              <div className="bg-amber-500 text-amber-900 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {getUIText('partnerLayout_impersonationView', language)} <strong>{user?.name}</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleReturnToAdmin}
                  className="bg-white text-amber-900 hover:bg-amber-100"
                  data-testid="return-to-admin-desktop"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {getUIText('partnerLayout_returnAdmin', language)}
                </Button>
              </div>
            )}
            
            {/* Breadcrumbs Bar */}
            <div className={WORKSPACE_TOOLBAR_ROW_CLASS}>
              {/* Breadcrumbs */}
              <nav className="flex items-center text-sm" aria-label={getUIText('partnerLayout_breadcrumbAria', language)}>
                <Link href="/" className="text-slate-400 hover:text-brand transition-colors">
                  <Home className="w-4 h-4" />
                </Link>
              {breadcrumbs.map((crumb) => (
                  <div key={crumb.href} className="flex items-center">
                    <ChevronRight className="w-4 h-4 mx-2 text-slate-300" />
                    {crumb.isLast ? (
                      <span className="font-medium text-slate-900">{crumb.name}</span>
                    ) : (
                      <Link 
                        href={crumb.href}
                        className="text-slate-500 hover:text-brand transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <HeaderWalletCompact />
                <PartnerNotificationFeed language={language} />
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-brand rounded-full"></div>
                  <span className="text-slate-600">{user?.name}</span>
                </div>
              </div>
            </div>
          </div>
          
          {!isListingWizardRoute ? (
            <div className={WORKSPACE_MOBILE_TOOLBAR_CLASS}>
              <nav className="flex items-center text-xs overflow-x-auto min-w-0 flex-1" aria-label={getUIText('partnerLayout_breadcrumbAria', language)}>
                {breadcrumbs.slice(-2).map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center whitespace-nowrap">
                    {index > 0 && <ChevronRight className="w-3 h-3 mx-1 text-slate-300 flex-shrink-0" />}
                    {crumb.isLast ? (
                      <span className="font-medium text-slate-900">{crumb.name}</span>
                    ) : (
                      <Link href={crumb.href} className="text-slate-500">
                        {crumb.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
              <PartnerNotificationFeed language={language} className="shrink-0" />
            </div>
          ) : null}

          {/* Page Content */}
          <div className={WORKSPACE_SCROLL_CLASS} {...{ [WORKSPACE_SCROLL_ATTR]: '' }}>
            {children}
          </div>
        </main>
      </div>

      {!isListingWizardRoute ? (
        <PartnerMobileBottomNav
          language={language}
          onMoreClick={() => setSidebarOpen(true)}
        />
      ) : null}
    </div>
    </PartnerNotificationProvider>
  )
}
