'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { INBOX_TAB_HOSTING, INBOX_TAB_TRAVELING } from '@/lib/chat-inbox-tabs'

/**
 * Переключатель Hosting / Traveling с бейджами непрочитанного по вкладкам.
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
  const isRu = language !== 'en'
  const hostingLabel = isRu ? 'Сдаю' : 'Hosting'
  const travelingLabel = isRu ? 'Снимаю' : 'Traveling'
  const hostingHint = isRu ? 'Сдаю объекты — диалоги по моим объявлениям' : 'Hosting — conversations about my listings'
  const travelingHint = isRu ? 'Traveling — я интересуюсь чужими объявлениями' : 'Traveling — inquiries on others’ listings'

  const TabBtn = ({ tab, label, title, unread }) => {
    const active = value === tab
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        title={title}
        onClick={() => onChange?.(tab)}
        className={cn(
          'relative flex-1 rounded-lg px-2 text-center font-semibold transition-colors',
          dense ? 'py-1 text-[11px] sm:text-xs' : 'py-2 text-xs sm:text-sm',
          active
            ? 'bg-teal-600 text-white shadow-sm'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
        )}
      >
        <span className="block truncate">{label}</span>
        {unread > 0 ? (
          <Badge
            className={cn(
              'h-5 min-w-[1.25rem] px-1.5 text-[10px] font-bold tabular-nums',
              dense ? 'mt-0.5' : 'mt-1',
              active ? 'bg-white text-teal-700 hover:bg-white' : 'bg-red-500 text-white hover:bg-red-500'
            )}
          >
            {unread > 99 ? '99+' : unread}
          </Badge>
        ) : null}
      </button>
    )
  }

  return (
    <div className={cn('flex gap-2', className)} role="tablist" aria-label={isRu ? 'Режим диалогов' : 'Conversation mode'}>
      <TabBtn tab={INBOX_TAB_HOSTING} label={hostingLabel} title={hostingHint} unread={hostingUnread} />
      <TabBtn tab={INBOX_TAB_TRAVELING} label={travelingLabel} title={travelingHint} unread={travelingUnread} />
    </div>
  )
}
