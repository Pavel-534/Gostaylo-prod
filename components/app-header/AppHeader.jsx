'use client'

/**
 * AppHeader — SSOT header для всего приложения Gostaylo.
 *
 * Три режима (автодетект по pathname, override через prop variant):
 *   • public    → /, /listings, /help, /about, /u/* — glass-white, hero-aware
 *   • workspace → /renter, /partner, /admin, /settings — solid-white + menu toggle
 *   • chat      → /messages/* — slim, минимальный (этап 3 sprint)
 *
 * Shadow recipe (единый воздух):
 *   - public:    backdrop-blur + subtle teal shadow
 *   - workspace: border-b + no glass (чётко для работы)
 *   - все:       h-16 (64px), sticky top-0 z-[100]
 *
 * @created 2026-02-05 Unified Header Sprint
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu, User, LogOut, ChevronDown, Heart, CalendarDays,
  Briefcase, Shield, MessageCircle, Gift, Home as HomeIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { CurrencySelector } from '@/components/currency-selector'
import { HeaderWalletCompact } from '@/components/wallet/HeaderWalletCompact'
import { AirentoLogo } from '@/components/brand/airento-logo'
import { LangSwitcher } from '@/components/app-header/LangSwitcher'
import { AdminImpersonationStripe } from '@/components/app-header/AdminImpersonationStripe'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useChatContext } from '@/lib/context/ChatContext'
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
  if (pathname.startsWith('/renter/bookings')) return t('Мои бронирования', 'My Bookings')
  if (pathname.startsWith('/renter/favorites')) return t('Избранное', 'Favorites')
  if (pathname.startsWith('/renter/profile')) return t('Профиль', 'Profile')
  if (pathname.startsWith('/renter/dashboard')) return t('Панель арендатора', 'Renter Dashboard')
  if (pathname.startsWith('/renter/settings')) return t('Настройки', 'Settings')
  if (pathname.startsWith('/renter')) return t('Личный кабинет', 'My Account')
  if (pathname.startsWith('/partner/finances')) return t('Финансы', 'Finances')
  if (pathname.startsWith('/partner/listings')) return t('Мои объекты', 'My Listings')
  if (pathname.startsWith('/partner/calendar')) return t('Календарь', 'Calendar')
  if (pathname.startsWith('/partner')) return t('Панель партнёра', 'Partner Dashboard')
  if (pathname.startsWith('/admin')) return t('Админ-панель', 'Admin')
  if (pathname.startsWith('/settings')) return t('Настройки', 'Settings')
  return null
}

// Public nav-links — только в Mode A
const PUBLIC_NAV = [
  { href: '/listings', key: 'navListings' },
  { href: '/listings', key: 'navDestinations' },
  { href: '/profile/referral', key: 'navMembership' },
  { href: '/help', key: 'navHelp' },
]

export function AppHeader({
  variant: variantOverride,
  centerSlot,              // опциональный custom slot в центре (напр. renter tabs)
  onMenuClick,             // workspace mobile — trigger sidebar drawer
  showMenuButton = true,   // workspace mode — показывать ли кнопку меню на мобильном
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const { language } = useI18n()
  const { currency, setCurrency } = useCurrency()
  const { user, logout, openLoginModal, isAdmin, isPartner, refreshUserFromServer } = useAuth()
  const { totalUnread } = useChatContext()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!mounted) return null

  const variant = variantOverride || detectVariant(pathname)

  // Mode C (chat) — не рендерим здесь, StickyChatHeader управляет своей зоной
  if (variant === 'chat') return null

  const isPublic = variant === 'public'
  const isWorkspace = variant === 'workspace'
  const workspaceTitle = isWorkspace && !centerSlot ? getWorkspaceTitle(pathname, language) : null

  const navigate = (href) => router.push(href)

  return (
    <header
      data-testid={`app-header-${variant}`}
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] transition-all duration-300',
        isPublic && 'border-b border-slate-200/80 backdrop-blur-md shadow-sm shadow-[#006666]/10',
        isWorkspace && 'border-b border-slate-200 bg-white',
        user?.is_impersonating && 'ring-1 ring-rose-200',
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
      {/* Admin impersonation stripe — всегда на самом верху; увеличивает header height */}
      <AdminImpersonationStripe />

      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">

          {/* LEFT — Menu toggle (workspace mobile) + Logo */}
          <div className="flex items-center gap-2 min-w-0">
            {isWorkspace && showMenuButton && (
              <button
                type="button"
                onClick={onMenuClick}
                aria-label="Menu"
                data-testid="app-header-menu-btn"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <Link
              href="/"
              data-testid="app-header-logo"
              className={cn(
                'group flex-shrink-0 rounded-2xl px-2.5 py-1.5 transition-all',
                isPublic && 'border border-white/70 bg-white/75 shadow-[0_10px_26px_rgba(0,102,102,0.1)] backdrop-blur-md hover:border-[#006666]/35 hover:shadow-[0_14px_30px_rgba(0,102,102,0.16)]',
                isWorkspace && 'hover:bg-slate-50',
              )}
            >
              <div className="flex items-center gap-3">
                <AirentoLogo compact label={getSiteDisplayName()} scrolled={scrolled} />
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
                      pathname?.startsWith('/partner') && 'bg-teal-50 text-teal-700',
                      (!pathname?.startsWith('/admin') && !pathname?.startsWith('/partner')) && 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {pathname?.startsWith('/admin') ? 'Admin' : pathname?.startsWith('/partner') ? 'Partner' : 'Renter'}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* CENTER — public nav OR workspace title OR custom slot */}
          {isPublic && (
            <nav className="hidden lg:flex flex-1 items-center gap-6">
              {PUBLIC_NAV.map((item, idx) => {
                const active =
                  (item.href === '/listings' && (pathname === '/listings' || pathname?.startsWith('/listings/'))) ||
                  (item.href === '/profile/referral' && pathname?.startsWith('/profile/referral')) ||
                  (item.href === '/help' && pathname?.startsWith('/help'))
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    data-testid={`app-header-nav-${item.key}`}
                    className={cn(
                      'text-sm font-medium transition-colors pb-1',
                      active ? 'text-[#006666] border-b-2 border-[#006666]' : 'text-slate-600 hover:text-[#006666]',
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

          {/* RIGHT — switchers + wallet + user */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Home-back на workspace */}
            {isWorkspace && (
              <Link
                href="/"
                aria-label={getUIText('partnerLayout_backToSiteAria', language) || 'Home'}
                data-testid="app-header-home-link"
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#006666]"
              >
                <HomeIcon className="h-4 w-4" />
              </Link>
            )}

            <LangSwitcher />
            <CurrencySelector value={currency} onChange={setCurrency} />

            {user ? <HeaderWalletCompact /> : null}

            {user ? (
              <DropdownMenu onOpenChange={(open) => { if (open) refreshUserFromServer?.() }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="app-header-user-menu"
                    className="flex h-8 sm:h-9 items-center gap-1 sm:gap-2 rounded-full border border-slate-200 px-1.5 sm:px-2 hover:bg-slate-100"
                  >
                    <span className="relative inline-flex shrink-0">
                      <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                        {user.avatar ? (
                          <AvatarImage src={toPublicImageUrl(user.avatar)} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback
                          className={cn(
                            'text-xs font-semibold text-white',
                            isAdmin ? 'bg-indigo-600' : isPartner ? 'bg-teal-600' : 'bg-slate-500',
                          )}
                        >
                          {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {totalUnread > 0 && (
                        <span className="pointer-events-none absolute -right-1 -top-0.5 hidden md:flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                          {totalUnread > 99 ? '99+' : String(totalUnread)}
                        </span>
                      )}
                    </span>
                    <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate font-semibold text-slate-900">{user.name || 'User'}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/renter/profile')}>
                      <User className="mr-3 h-4 w-4 text-slate-400" />
                      <span>{language === 'ru' ? 'Профиль' : 'Profile'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/renter/bookings')}>
                      <CalendarDays className="mr-3 h-4 w-4 text-slate-400" />
                      <span>{language === 'ru' ? 'Мои бронирования' : 'My Bookings'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="hidden md:flex cursor-pointer flex-row items-center justify-between gap-2 py-2.5 pr-2"
                      onSelect={() => navigate('/messages/')}
                    >
                      <span className="flex min-w-0 items-center">
                        <MessageCircle className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
                        <span>{language === 'ru' ? 'Сообщения' : 'Messages'}</span>
                      </span>
                      {totalUnread > 0 && (
                        <span className="flex min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                          {totalUnread > 99 ? '99+' : String(totalUnread)}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/profile/referral')}>
                      <Gift className="mr-3 h-4 w-4 text-slate-400" />
                      <span>{language === 'ru' ? 'Реферальная программа' : 'Referral'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/renter/favorites')}>
                      <Heart className="mr-3 h-4 w-4 text-slate-400" />
                      <span>{language === 'ru' ? 'Избранное' : 'Favorites'}</span>
                    </DropdownMenuItem>
                  </div>
                  {(isAdmin || isPartner) && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="py-1">
                        <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/partner/dashboard')}>
                          <Briefcase className="mr-3 h-4 w-4 text-teal-600" />
                          <span className="font-medium text-teal-700">
                            {language === 'ru' ? 'Панель партнёра' : 'Partner Dashboard'}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="py-1">
                        <DropdownMenuItem className="cursor-pointer py-2.5" onSelect={() => navigate('/admin')}>
                          <Shield className="mr-3 h-4 w-4 text-indigo-600" />
                          <span className="font-medium text-indigo-700">
                            {language === 'ru' ? 'Админ-панель' : 'Admin'}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <div className="py-1">
                    <DropdownMenuItem
                      onClick={logout}
                      className="cursor-pointer py-2.5 text-red-600 focus:bg-red-50 focus:text-red-600"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>{getUIText('logout', language)}</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                data-testid="app-header-login"
                className="h-9 rounded-full bg-teal-600 px-4 font-medium hover:bg-teal-700"
                onClick={openLoginModal}
              >
                {getUIText('login', language)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
