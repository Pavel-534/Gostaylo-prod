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
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { useChatContext } from '@/lib/context/ChatContext'
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
  Menu,
  X,
  Home,
  ChevronRight,
  Plus,
  Shield,
  LogIn,
  Bell,
  ArrowLeft,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { Badge } from '@/components/ui/badge'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'

const SIDEBAR_CONFIG = [
  { nameKey: 'partnerNav_dashboard', href: '/partner/dashboard', icon: LayoutDashboard, descKey: 'partnerNav_dashboardDesc' },
  { nameKey: 'partnerNav_listings', href: '/partner/listings', icon: Briefcase, descKey: 'partnerNav_listingsDesc' },
  { nameKey: 'partnerNav_calendar', href: '/partner/calendar', icon: Calendar, descKey: 'partnerNav_calendarDesc' },
  { nameKey: 'partnerNav_bookings', href: '/partner/bookings', icon: Inbox, descKey: 'partnerNav_bookingsDesc' },
  { nameKey: 'partnerNav_messages', href: '/messages', icon: MessageSquare, descKey: 'partnerNav_messagesDesc', badge: null },
  { nameKey: 'partnerNav_finances', href: '/partner/finances', icon: Banknote, descKey: 'partnerNav_financesDesc' },
  { nameKey: 'partnerNav_payoutProfiles', href: '/partner/payout-profiles', icon: Wallet, descKey: 'partnerNav_payoutProfilesDesc' },
  { nameKey: 'partnerNav_settings', href: '/partner/settings', icon: Settings, descKey: 'partnerNav_settingsDesc' },
]

export default function PartnerLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false)
  const { totalUnread } = useChatContext()
  const [language, setLanguage] = useState('ru')

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

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  useEffect(() => {
    const syncUserFromSession = async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (res.ok && data.success && data.user) {
          const u = data.user
          const merged = {
            id: u.id,
            email: u.email,
            role: u.role,
            name: u.name,
            first_name: u.first_name,
            last_name: u.last_name,
            phone: u.phone,
            avatar: u.avatar,
            referral_code: u.referral_code,
            is_verified: u.is_verified,
            telegram_id: u.telegram_id,
            telegram_username: u.telegram_username,
          }
          localStorage.setItem('gostaylo_user', JSON.stringify(merged))
          setUser((prev) => (prev?.isImpersonated ? prev : merged))
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('gostaylo-refresh-session', syncUserFromSession)
    window.addEventListener('auth-change', syncUserFromSession)
    return () => {
      window.removeEventListener('gostaylo-refresh-session', syncUserFromSession)
      window.removeEventListener('auth-change', syncUserFromSession)
    }
  }, [])

  // Partner access from DB via /auth/me (fixes stale localStorage after role change); keep impersonation path
  useEffect(() => {
    let cancelled = false

    async function resolveAccess() {
      let parsed = null
      try {
        const raw = localStorage.getItem('gostaylo_user')
        if (raw) parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }

      if (parsed?.isImpersonated) {
        if (cancelled) return
        setUser(parsed)
        setIsImpersonating(true)
        const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(parsed.role)
        setAccessDenied(!hasAccess)
        setIsNotLoggedIn(false)
        setLoading(false)
        if (typeof window !== 'undefined') {
          setSidebarOpen(window.innerWidth >= 1024)
        }
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return

        if (res.ok && data.success && data.user) {
          const u = data.user
          const merged = {
            id: u.id,
            email: u.email,
            role: u.role,
            name: u.name,
            first_name: u.first_name,
            last_name: u.last_name,
            phone: u.phone,
            avatar: u.avatar,
            referral_code: u.referral_code,
            is_verified: u.is_verified,
            telegram_id: u.telegram_id,
            telegram_username: u.telegram_username,
          }
          localStorage.setItem('gostaylo_user', JSON.stringify(merged))
          setUser(merged)
          setIsImpersonating(false)
          const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(u.role)
          setAccessDenied(!hasAccess)
          setIsNotLoggedIn(false)
        } else {
          if (res.status === 401) {
            setUser(null)
            setAccessDenied(true)
            setIsNotLoggedIn(true)
          } else if (parsed) {
            const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(parsed.role)
            setUser(parsed)
            setIsImpersonating(false)
            setAccessDenied(!hasAccess)
            setIsNotLoggedIn(false)
          } else {
            setUser(null)
            setAccessDenied(true)
            setIsNotLoggedIn(true)
          }
        }
      } catch {
        if (cancelled) return
        if (parsed) {
          const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(parsed.role)
          setUser(parsed)
          setAccessDenied(!hasAccess)
          setIsNotLoggedIn(false)
        } else {
          setAccessDenied(true)
          setIsNotLoggedIn(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
        if (typeof window !== 'undefined') {
          setSidebarOpen(window.innerWidth >= 1024)
        }
      }
    }

    resolveAccess()
    return () => {
      cancelled = true
    }
  }, [pathname])

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

  const handleReturnToAdmin = () => {
    const savedAdmin = localStorage.getItem('gostaylo_original_admin')
    if (savedAdmin) {
      localStorage.setItem('gostaylo_user', savedAdmin)
      localStorage.removeItem('gostaylo_original_admin')
      window.location.href = '/admin/users'
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('gostaylo_user')
    localStorage.removeItem('gostaylo_original_admin')
    window.location.href = '/'
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-3"></div>
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
                  className="bg-teal-600 hover:bg-teal-700 w-full"
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
              <Button asChild className="bg-teal-600 hover:bg-teal-700 w-full">
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

  // Get stable QueryClient instance
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-30 lg:hidden">
        {/* Impersonation Banner - Mobile */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-900 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium truncate flex-1">
              👤 {getUIText('partnerLayout_impersonationMode', language)} {user?.name}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReturnToAdmin}
              className="bg-white text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs ml-2"
              data-testid="return-to-admin-mobile"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              {getUIText('partnerLayout_back', language)}
            </Button>
          </div>
        )}
        
        {/* Main Mobile Header */}
        <div className="h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          
          <div className="text-center flex-1 mx-3">
            <Link href="/partner/dashboard" className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">GS</span>
              </div>
              <span className="font-semibold text-slate-900">{getUIText('partnerLayout_brandPartner', language)}</span>
            </Link>
          </div>
          
          {/* Mobile Quick Actions */}
          <div className="flex items-center gap-1">
            <Link 
              href="/"
              className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              aria-label={getUIText('partnerLayout_backToSiteAria', language)}
            >
              <Home className="w-5 h-5 text-slate-500" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } w-64 bg-white border-r border-slate-200 transition-all duration-300 ease-out flex flex-col fixed h-screen z-50 lg:z-30 shadow-lg lg:shadow-none`}
        >
          {/* Logo & Close */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <Link href="/partner/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-slate-900">GoStayLo</h1>
                <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Partner Portal</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-all lg:hidden"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-slate-200">
                {user?.avatar ? (
                  <AvatarImage src={toPublicImageUrl(user.avatar)} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-teal-100 text-teal-700 text-sm font-semibold">
                  {user?.name?.[0]?.toUpperCase() || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.name || 'Partner'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Create Listing Button */}
          <div className="px-4 py-3">
            <Button 
              asChild 
              className="w-full bg-teal-600 hover:bg-teal-700 shadow-sm"
              data-testid="create-listing-btn"
            >
              <Link href="/partner/listings/new">
                <Plus className="w-4 h-4 mr-2" />
                {getUIText('partnerNav_createListing', language)}
              </Link>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              const isMessagesItem = item.href === '/messages'
              const isActive = isMessagesItem
                ? pathname === '/messages' ||
                  pathname?.startsWith('/messages/')
                : pathname === item.href ||
                  (item.href !== '/partner/dashboard' && pathname?.startsWith(item.href))
              const isMessages = isMessagesItem
              const showUnreadDot = isMessages && totalUnread > 0 && !isActive
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false)
                    }
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    {showUnreadDot && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                    )}
                  </span>
                  <span className={`text-sm flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.name}
                  </span>
                  {isMessages && totalUnread > 0 && !isActive && (
                    <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Badge>
                  )}
                  {item.badge && !isMessages && (
                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom Section */}
          <div className="p-3 border-t border-slate-100 space-y-2">
            <Link 
              href="/" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{getUIText('partnerNav_publicSite', language)}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-all w-full text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>{getUIText('logout', language)}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 w-full min-w-0 max-w-full overflow-x-hidden">
          {/* Desktop Top Bar */}
          <div className="hidden lg:block sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 z-10">
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
            <div className="px-6 py-3 flex items-center justify-between">
              {/* Breadcrumbs */}
              <nav className="flex items-center text-sm" aria-label="Breadcrumb">
                <Link href="/" className="text-slate-400 hover:text-teal-600 transition-colors">
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
                        className="text-slate-500 hover:text-teal-600 transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-slate-700"
                >
                  <Bell className="w-4 h-4" />
                </Button>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  <span className="text-slate-600">{user?.name}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:hidden px-4 py-2 bg-white border-b border-slate-100">
            <nav className="flex items-center text-xs overflow-x-auto" aria-label="Breadcrumb">
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
          </div>

          {/* Page Content */}
          <div className="p-4 lg:p-6 max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
    </QueryClientProvider>
  )
}
