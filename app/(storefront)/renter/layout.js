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

import '@/lib/translations/register-booking-common-i18n'
import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  Home, Calendar, MessageSquare, Heart, User, 
  X, Loader2, Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { useChatUnreadBadge } from '@/lib/context/ChatUnreadBadgeContext'
import { AppHeader } from '@/components/app-header/AppHeader'
import { useAuth } from '@/contexts/auth-context'

// Navigation items
const NAV_ITEMS = [
  { 
    href: '/renter/dashboard', 
    labelKey: 'dashboard', 
    icon: Home,
    descriptionKey: 'dashboardDesc'
  },
  { 
    href: '/my-bookings', 
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
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [language, setLanguage] = useState('ru')
  const { totalUnread } = useChatUnreadBadge()
  const { user, loading: authLoading, isAuthenticated } = useAuth()

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

  const allowedRoles = ['RENTER', 'ADMIN', 'MODERATOR', 'PARTNER']
  const accessDenied = !authLoading && (!isAuthenticated || !allowedRoles.includes(String(user?.role || '').toUpperCase()))

  // Loading state
  if (authLoading) {
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
      <div className="min-h-screen bg-brand-surface flex flex-col">
        <AppHeader
          variant="workspace"
          onMenuClick={() => setSidebarOpen((v) => !v)}
          centerSlot={
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isMessagesItem = item.href === '/messages'
                const isActive = isMessagesItem
                  ? pathname === '/messages' || pathname?.startsWith('/messages/')
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                const showBadge = isMessagesItem && totalUnread > 0 && !isActive
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors relative text-sm',
                      isActive ? 'gsl-nav-item-active font-medium' : 'gsl-nav-item-idle',
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-4 w-4" />
                      {showBadge && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                      )}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          }
        />

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={cn(
            'fixed left-0 bottom-0 w-72 bg-white border-r z-40 transform transition-transform md:hidden top-[var(--app-header-height,64px)]',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
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

        {/* Main Content — ADR-100: own shell insets (MainContent bypass for /renter) */}
        <main className="container mx-auto flex-1 min-h-0 px-4 pt-[calc(var(--app-header-height,64px)+1.5rem)] md:pt-[var(--app-header-height,64px)] pb-bottom-nav md:pb-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-slate-600">
            <p>© 2026 {getSiteDisplayName()}. Rentals worldwide.</p>
          </div>
        </footer>
      </div>
  )
}
