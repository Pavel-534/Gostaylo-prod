/**
 * Gostaylo - Partner Dashboard Layout (World-Class UX)
 * 
 * Features:
 * - Professional sidebar with universal business icons
 * - Collapsible drawer on mobile (hamburger menu)
 * - Breadcrumbs navigation
 * - "+ Create Listing" button
 * - Future-ready for Firebase push notifications
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard,
  Briefcase,
  Calendar,
  Inbox,
  MessageSquare,
  Banknote,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Toaster } from 'sonner'

// Sidebar navigation items with universal business icons
const SIDEBAR_ITEMS = [
  { 
    name: 'Обзор', 
    href: '/partner/dashboard', 
    icon: LayoutDashboard,
    description: 'Статистика и быстрые действия'
  },
  { 
    name: 'Объекты', 
    href: '/partner/listings', 
    icon: Briefcase,
    description: 'Управление объявлениями'
  },
  { 
    name: 'Календарь', 
    href: '/partner/calendar', 
    icon: Calendar,
    description: 'Доступность и iCal синхронизация'
  },
  { 
    name: 'Бронирования', 
    href: '/partner/bookings', 
    icon: Inbox,
    description: 'Входящие запросы'
  },
  { 
    name: 'Сообщения', 
    href: '/partner/messages', 
    icon: MessageSquare,
    description: 'Чат с арендаторами',
    badge: null // Future: unread count from Firebase
  },
  { 
    name: 'Финансы', 
    href: '/partner/finances', 
    icon: Banknote,
    description: 'Доходы и выплаты'
  },
  { 
    name: 'Настройки', 
    href: '/partner/settings', 
    icon: Settings,
    description: 'Уведомления и профиль'
  },
]

// Breadcrumb mapping for human-readable names
const BREADCRUMB_NAMES = {
  'partner': 'Партнёр',
  'dashboard': 'Обзор',
  'listings': 'Объекты',
  'calendar': 'Календарь',
  'bookings': 'Бронирования',
  'messages': 'Сообщения',
  'finances': 'Финансы',
  'settings': 'Настройки',
  'new': 'Создание',
  'edit': 'Редактирование',
  'referrals': 'Рефералы',
  'reviews': 'Отзывы',
}

export default function PartnerLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false)

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  // Check access and load user
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        setIsImpersonating(!!parsed.isImpersonated)
        
        // Check if user has partner access
        const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(parsed.role)
        if (!hasAccess) {
          setAccessDenied(true)
          setIsNotLoggedIn(false)
        }
      } catch (e) {
        setAccessDenied(true)
        setIsNotLoggedIn(true)
      }
    } else {
      setAccessDenied(true)
      setIsNotLoggedIn(true)
    }
    setLoading(false)

    // Set initial sidebar state based on screen width
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024)
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
      
      crumbs.push({
        name: isUUID ? 'Детали' : (BREADCRUMB_NAMES[segment] || segment),
        href: currentPath,
        isLast: index === segments.length - 1
      })
    })
    
    return crumbs
  }, [pathname])

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
          <p className="text-slate-500 text-sm">Загрузка...</p>
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
            {isNotLoggedIn ? 'Требуется авторизация' : 'Доступ ограничен'}
          </h1>
          <p className="text-slate-500 mb-6">
            {isNotLoggedIn 
              ? 'Войдите в аккаунт, чтобы просмотреть эту страницу' 
              : 'Эта страница доступна только партнёрам Gostaylo'}
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
                  Войти в аккаунт
                </Button>
                <p className="text-xs text-slate-400">
                  После входа вы будете перенаправлены обратно
                </p>
              </>
            ) : (
              <Button asChild className="bg-teal-600 hover:bg-teal-700 w-full">
                <Link href="/profile" data-testid="access-denied-become-partner-btn">
                  Стать партнёром
                </Link>
              </Button>
            )}
            <Button variant="ghost" asChild className="w-full">
              <Link href="/">На главную</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Toaster position="top-right" richColors />
      
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
              👤 Режим: {user?.name}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReturnToAdmin}
              className="bg-white text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs ml-2"
              data-testid="return-to-admin-mobile"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Назад
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
              <span className="font-semibold text-slate-900">Partner</span>
            </Link>
          </div>
          
          {/* Mobile Quick Actions */}
          <div className="flex items-center gap-1">
            <Link 
              href="/"
              className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              aria-label="На сайт"
            >
              <Home className="w-5 h-5 text-slate-500" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1">
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
                <h1 className="font-bold text-slate-900">Gostaylo</h1>
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
              <Avatar className="h-9 w-9">
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
                Создать объявление
              </Link>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                (item.href !== '/partner/dashboard' && pathname?.startsWith(item.href))
              
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
                  <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.name}
                  </span>
                  {item.badge && (
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
              <span>На сайт</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-all w-full text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 w-full max-w-full overflow-x-hidden">
          {/* Desktop Top Bar */}
          <div className="hidden lg:block sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 z-10">
            {/* Impersonation Banner - Desktop */}
            {isImpersonating && (
              <div className="bg-amber-500 text-amber-900 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Режим просмотра: <strong>{user?.name}</strong>
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
                  Вернуться в Admin
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
                {breadcrumbs.map((crumb, index) => (
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
          
          {/* Mobile Breadcrumbs */}
          <div className="lg:hidden px-4 py-2 bg-white border-b border-slate-100">
            <nav className="flex items-center text-xs overflow-x-auto" aria-label="Breadcrumb">
              {breadcrumbs.slice(-2).map((crumb, index, arr) => (
                <div key={crumb.href} className="flex items-center whitespace-nowrap">
                  {index > 0 && <ChevronRight className="w-3 h-3 mx-1 text-slate-300 flex-shrink-0" />}
                  {crumb.isLast ? (
                    <span className="font-medium text-slate-900">{crumb.name}</span>
                  ) : (
                    <Link 
                      href={crumb.href}
                      className="text-slate-500"
                    >
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
  )
}
