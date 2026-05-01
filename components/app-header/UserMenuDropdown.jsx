'use client'

/**
 * UserMenuDropdown — avatar + выпадающее меню пользователя.
 * Extracted from AppHeader для чистоты (SRP).
 *
 * Props:
 *   - variant: 'public'|'workspace' (для стилизации avatar fallback)
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User, LogOut, ChevronDown, Heart, CalendarDays,
  Briefcase, Shield, MessageCircle, Gift,
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
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useChatContext } from '@/lib/context/ChatContext'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

export function UserMenuDropdown() {
  const router = useRouter()
  const { language } = useI18n()
  const { user, logout, openLoginModal, isAdmin, isPartner, refreshUserFromServer } = useAuth()
  const { totalUnread } = useChatContext()

  const navigate = (href) => router.push(href)

  if (!user) {
    return (
      <Button
        size="sm"
        data-testid="app-header-login"
        className="h-9 rounded-full bg-teal-600 px-4 font-medium hover:bg-teal-700"
        onClick={openLoginModal}
      >
        {getUIText('login', language)}
      </Button>
    )
  }

  return (
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
  )
}

export default UserMenuDropdown
