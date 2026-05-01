'use client'

/**
 * ChatTopBar — slim-вариант AppHeader для /messages/*.
 *
 * Показывается ТОЛЬКО на desktop (lg+). Mobile: thread занимает весь экран
 * (лучший UX для чата), StickyChatHeader полностью владеет верхней зоной.
 *
 * Контракт:
 *   - h-12 (48px), sticky top-0 z-[100].
 *   - [← Back] [Logo] [Thread context] [LangSwitcher] [Avatar]
 *   - Использует --app-header-height (48px → StickyChatHeader под ним).
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { AirentoLogo } from '@/components/brand/airento-logo'
import { LangSwitcher } from '@/components/app-header/LangSwitcher'
import { UserMenuDropdown } from '@/components/app-header/UserMenuDropdown'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { useChatContext } from '@/lib/context/ChatContext'
import { cn } from '@/lib/utils'

export function ChatTopBar({ threadTitle = null, onBack = null }) {
  const router = useRouter()
  const { language } = useI18n()
  const { totalUnread } = useChatContext()
  const ref = useRef(null)

  // --app-header-height для StickyChatHeader sticky-offset (desktop)
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
    return () => { ro.disconnect() }
  }, [])

  const handleBack = () => {
    if (typeof onBack === 'function') return onBack()
    router.push('/messages')
  }

  return (
    <header
      ref={ref}
      data-testid="app-header-chat"
      className={cn(
        // Desktop only — mobile thread полноэкранный
        'hidden lg:flex sticky top-0 z-[100] h-12 items-center gap-3 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4',
      )}
    >
      {/* LEFT — Back + Logo */}
      <button
        type="button"
        onClick={handleBack}
        aria-label={language === 'ru' ? 'Назад к списку диалогов' : 'Back to conversations'}
        data-testid="app-header-chat-back"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <Link
        href="/"
        data-testid="app-header-chat-logo"
        className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50"
      >
        <AirentoLogo compact label={getSiteDisplayName()} scrolled={true} />
      </Link>

      {/* CENTER — context title */}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
        <MessageCircle className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="truncate font-medium" data-testid="app-header-chat-title">
          {threadTitle || (language === 'ru' ? 'Сообщения' : 'Messages')}
        </span>
        {totalUnread > 0 && (
          <span
            className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white"
            aria-label={`${totalUnread} unread`}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </div>

      {/* RIGHT — switchers + user */}
      <div className="flex items-center gap-1">
        <LangSwitcher />
        <UserMenuDropdown />
      </div>
    </header>
  )
}

export default ChatTopBar
