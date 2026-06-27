'use client'

import { cn } from '@/lib/utils'
import { INBOX_TAB_HOSTING, INBOX_TAB_TRAVELING } from '@/lib/chat-inbox-tabs'
import { getUIText } from '@/lib/translations'

/**
 * Переключатель Hosting / Traveling с бейджами непрочитанного по вкладкам.
 * Бейдж в одной строке с текстом — без «высоких» кнопок.
 */
export function ChatInboxRoleTabs({
  value,
  onChange,
  hostingUnread = 0,
  travelingUnread = 0,
  language = 'ru',
  className,
  dense = false,
}) {
  const TabBtn = ({ tab, labelKey, hintKey, unread }) => {
    const active = value === tab
    const n = unread > 99 ? '99+' : unread > 0 ? String(unread) : null
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        title={getUIText(hintKey, language)}
        onClick={() => onChange?.(tab)}
        className={cn(
          'relative flex min-h-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-2 text-center font-semibold transition-colors',
          dense ? 'py-1.5 text-[11px] sm:text-xs' : 'py-2 text-xs sm:text-sm',
          active
            ? 'bg-brand text-white shadow-sm'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
        )}
      >
        <span className="truncate">{getUIText(labelKey, language)}</span>
        {n != null ? (
          <span
            className={cn(
              'inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none tabular-nums sm:text-[10px]',
              active ? 'bg-white/25 text-white' : 'bg-red-500 text-white',
            )}
            aria-hidden
          >
            {n}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div
      className={cn('flex gap-2', className)}
      role="tablist"
      aria-label={getUIText('chatInbox_roleModeAria', language)}
    >
      <TabBtn
        tab={INBOX_TAB_HOSTING}
        labelKey="chatInbox_tabHosting"
        hintKey="chatInbox_tabHostingHint"
        unread={hostingUnread}
      />
      <TabBtn
        tab={INBOX_TAB_TRAVELING}
        labelKey="chatInbox_tabTraveling"
        hintKey="chatInbox_tabTravelingHint"
        unread={travelingUnread}
      />
    </div>
  )
}
