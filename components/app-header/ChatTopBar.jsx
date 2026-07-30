'use client'

/**
 * ChatTopBar — slim chrome for /messages/*.
 *
 * Hall (/messages, /messages/archived): all breakpoints — brand + back + catalog/home.
 * Thread (/messages/[id]): desktop (lg+) only; mobile uses StickyChatHeader.
 *
 * Contract: h-12 sticky z-[100]; sets --app-header-height for StickyChatHeader.
 */

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Home, MessageCircle, Search } from 'lucide-react'
import { AirentoLogo } from '@/components/brand/airento-logo'
import { LangSwitcher } from '@/components/app-header/LangSwitcher'
import { UserMenuDropdown } from '@/components/app-header/UserMenuDropdown'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { useChatContext } from '@/lib/context/ChatContext'
import { cn } from '@/lib/utils'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'
import { useSoftBack } from '@/hooks/use-soft-back'

function normalizeMessagesPath(pathname) {
  return String(pathname || '').replace(/\/+$/, '') || ''
}

export function ChatTopBar({ threadTitle = null, onBack = null }) {
  const router = useRouter()
  const pathname = usePathname()
  const { language } = useI18n()
  const { totalUnread } = useChatContext()
  const ref = useRef(null)
  const softBackToMessages = useSoftBack('/messages')
  const softBackToListings = useSoftBack('/listings')

  const pathNorm = useMemo(() => normalizeMessagesPath(pathname), [pathname])
  const isArchivedHall = pathNorm === '/messages/archived'
  const isHall = pathNorm === '/messages' || isArchivedHall

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--app-header-height', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [isHall])

  const handleBack = () => {
    if (typeof onBack === 'function') return onBack()
    if (isArchivedHall) {
      dispatchOptimisticNavPending('/messages')
      router.push('/messages')
      return
    }
    if (isHall) {
      softBackToListings()
      return
    }
    softBackToMessages()
  }

  const backAria = isArchivedHall
    ? language === 'ru'
      ? 'Назад к списку диалогов'
      : 'Back to conversations'
    : isHall
      ? language === 'ru'
        ? 'Назад'
        : 'Back'
      : language === 'ru'
        ? 'Назад к списку диалогов'
        : 'Back to conversations'

  const titleText =
    threadTitle ||
    (isArchivedHall
      ? language === 'ru'
        ? 'Архив'
        : 'Archive'
      : language === 'ru'
        ? 'Сообщения'
        : 'Messages')

  return (
    <header
      ref={ref}
      data-testid="app-header-chat"
      data-chat-hall={isHall ? '1' : '0'}
      className={cn(
        'sticky top-0 z-[100] h-12 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md sm:gap-3 sm:px-4',
        isHall ? 'flex' : 'hidden lg:flex',
      )}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label={backAria}
        data-testid="app-header-chat-back"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition-colors hover:bg-slate-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <Link
        href="/"
        data-testid="app-header-chat-logo"
        onClick={() => dispatchOptimisticNavPending('/')}
        className="flex min-w-0 shrink-0 items-center gap-2 rounded-2xl px-1 py-1 hover:bg-slate-50 touch-manipulation active:scale-[0.99]"
      >
        <AirentoLogo compact label={getSiteDisplayName()} scrolled hideLabelOnMobile />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
        <MessageCircle className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden />
        <span className="truncate font-medium" data-testid="app-header-chat-title">
          {titleText}
        </span>
        {totalUnread > 0 && !isArchivedHall ? (
          <span
            className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white"
            aria-label={`${totalUnread} unread`}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {isHall ? (
          <>
            <Link
              href="/listings"
              data-testid="app-header-chat-catalog"
              onClick={() => dispatchOptimisticNavPending('/listings')}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl px-2 text-sm font-medium text-brand-hover transition-colors hover:bg-brand/10 touch-manipulation active:scale-[0.99]"
              title={language === 'ru' ? 'Каталог и поиск' : 'Catalog & search'}
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden md:inline">{language === 'ru' ? 'Каталог' : 'Catalog'}</span>
            </Link>
            <Link
              href="/"
              data-testid="app-header-chat-home"
              onClick={() => dispatchOptimisticNavPending('/')}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 touch-manipulation active:scale-[0.99]"
              title={language === 'ru' ? 'Главная' : 'Home'}
            >
              <Home className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden md:inline">{language === 'ru' ? 'Главная' : 'Home'}</span>
            </Link>
          </>
        ) : null}
        <div className="hidden items-center gap-1 sm:flex">
          <LangSwitcher />
          <UserMenuDropdown />
        </div>
      </div>
    </header>
  )
}

export default ChatTopBar
