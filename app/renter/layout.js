/**
 * GoStayLo - Renter Portal Layout
 * 
 * Features:
 * - Server-side session validation
 * - TanStack Query provider
 * - Navigation sidebar
 * - Responsive design
 * 
 * @version 2.0 (v2 Architecture)
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  Home, Calendar, MessageSquare, Heart, User, 
  Menu, X, LogOut, Loader2, MapPin, Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { useChatContext } from '@/lib/context/ChatContext'

// TanStack Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// Navigation items
const NAV_ITEMS = [
  { 
    href: '/renter/dashboard', 
    labelKey: 'dashboard', 
    icon: Home,
    descriptionKey: 'dashboardDesc'
  },
  { 
    href: '/renter/bookings', 
    labelKey: 'bookings', 
    icon: Calendar,
    descriptionKey: 'bookingsDesc'
  },
  { 
    href: '/messages', 
    labelKey: 'messages', 
    icon: MessageSquare,
    descriptionKey: 'messagesDesc'
  },
  { 
    href: '/renter/favorites', 
    labelKey: 'favorites', 
    icon: Heart,
    descriptionKey: 'favoritesDesc'
  },
  { 
    href: '/renter/profile', 
    labelKey: 'profile', 
    icon: User,
    descriptionKey: 'profileDesc'
  },
  {
    href: '/renter/settings',
    labelKey: 'settings',
    icon: Settings,
    descriptionKey: 'settingsDesc'
  }
]

export default function RenterLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [language, setLanguage] = useState('ru')
  const { totalUnread } = useChatContext()

  useEffect(() => {
    const initial = detectLanguage()
    setLanguage(initial)
    persistLanguage(initial)
    document.documentElement.lang = initial

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

  const navItems = useMemo(() => {
    const desc = {
      dashboardDesc: getUIText('renterNav_dashboardDesc', language),
      bookingsDesc: getUIText('renterNav_bookingsDesc', language),
      messagesDesc: getUIText('renterNav_messagesDesc', language),
      favoritesDesc: getUIText('renterNav_favoritesDesc', language),
      profileDesc: getUIText('renterNav_profileDesc', language),
      settingsDesc: getUIText('renterNav_settingsDesc', language),
    }
    return NAV_ITEMS.map(i => ({
      ...i,
      label: getUIText(i.labelKey, language),
      description: desc[i.descriptionKey] || ''
    }))
  }, [language])

  // Session validation & auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get user from localStorage (client-side session)
        const storedUser = localStorage.getItem('gostaylo_user')
        
        if (!storedUser) {
          setAccessDenied(true)
          setLoading(false)
          return
        }

        const parsedUser = JSON.parse(storedUser)
        
        // Validate role - Renter portal accepts RENTER, ADMIN, MODERATOR, PARTNER (partner can also book as renter)
        const allowedRoles = ['RENTER', 'ADMIN', 'MODERATOR', 'PARTNER']
        
        if (!allowedRoles.includes(parsedUser.role)) {
          setAccessDenied(true)
          setLoading(false)
          return
        }

        setUser(parsedUser)
        setLoading(false)
        
      } catch (error) {
        setAccessDenied(true)
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    const onSync = () => {
      try {
        const raw = localStorage.getItem('gostaylo_user')
        if (raw) setUser(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('gostaylo-refresh-session', onSync)
    window.addEventListener('auth-change', onSync)
    return () => {
      window.removeEventListener('gostaylo-refresh-session', onSync)
      window.removeEventListener('auth-change', onSync)
    }
  }, [])

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('gostaylo_user')
    router.push('/')
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-slate-600">{getUIText('loading', language)}</p>
        </div>
      </div>
    )
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {getUIText('renterPortal_signInTitle', language)}
          </h2>
          <p className="text-slate-600 mb-6">
            {getUIText('renterPortal_signInBody', language)}
          </p>
          <Button 
            asChild 
            className="bg-teal-600 hover:bg-teal-700 w-full"
          >
            <Link href="/profile?login=true">
              {getUIText('renterPortal_signInCta', language)}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* На мобиле fixed надёжнее sticky (Yandex/Chrome); отступ под шапку только &lt;md */}
        <div className="h-16 shrink-0 md:hidden" aria-hidden="true" />
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm md:static md:z-auto">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">GS</span>
                </div>
                <div className="hidden sm:block">
                  <span className="font-bold text-slate-900 text-lg">{getSiteDisplayName()}</span>
                  <span className="block text-xs text-slate-500">My Trips</span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isMessagesItem = item.href === '/messages'
                  const isActive = isMessagesItem
                    ? pathname === '/messages' ||
                      pathname?.startsWith('/messages/')
                    : pathname === item.href || pathname.startsWith(item.href + '/')
                  const isMessages = isMessagesItem
                  const showBadge = isMessages && totalUnread > 0 && !isActive
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors relative",
                        isActive 
                          ? "bg-teal-50 text-teal-700 font-medium" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="relative">
                        <Icon className="h-4 w-4" />
                        {showBadge && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                        )}
                      </span>
                      <span className="text-sm">{item.label}</span>
                      {showBadge && (
                        <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[9px] leading-none">
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </nav>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-slate-200 hidden sm:flex">
                  {user?.avatar ? (
                    <AvatarImage src={toPublicImageUrl(user.avatar)} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-teal-100 text-teal-800 text-sm font-semibold">
                    {(user?.first_name?.[0] || user?.name?.[0] || user?.email?.[0] || 'G').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* User Info */}
                <div className="hidden lg:block text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {user?.first_name || user?.name || 'Guest'}
                  </p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>

                {/* Browse Listings Button */}
                <Button 
                  asChild 
                  variant="outline" 
                  size="sm"
                  className="hidden sm:flex border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  <Link href="/listings">
                    <MapPin className="h-4 w-4 mr-2" />
                    {getUIText('browse', language)}
                  </Link>
                </Button>

                {/* Logout */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                </Button>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {sidebarOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div 
          className={cn(
            "fixed top-16 left-0 bottom-0 w-72 bg-white border-r z-40 transform transition-transform md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isMessagesItem = item.href === '/messages'
              const isActive = isMessagesItem
                ? pathname === '/messages' ||
                  pathname?.startsWith('/messages/')
                : pathname === item.href || pathname.startsWith(item.href + '/')
              const isMessages = isMessagesItem
              const showBadge = isMessages && totalUnread > 0 && !isActive
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive 
                      ? "bg-teal-50 text-teal-700 font-medium" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-5 w-5" />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  {showBadge && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] shrink-0">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 flex-1 min-h-0 pb-bottom-nav">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-slate-600">
            <p>© 2026 {getSiteDisplayName()}. Luxury rentals in Phuket.</p>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  )
}
