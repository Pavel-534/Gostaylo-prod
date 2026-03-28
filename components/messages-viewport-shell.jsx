'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Каркас высоты dvh для /messages: на треде (/messages/[id]) без отступа под MobileBottomNav.
 */
export function MessagesViewportShell({ children }) {
  const pathname = usePathname() || ''
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const isThread = /^\/messages\/.+/.test(normalized) && normalized !== '/messages'

  return (
    <div
      className={cn(
        'flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-slate-50',
        !isThread && 'max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
