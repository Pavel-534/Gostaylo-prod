'use client'

/**
 * Каркас высоты dvh для /messages. Нижний таббар на холле и в треде скрыт — отступ не нужен.
 *
 * 2026-02-05: интеграция единого ChatTopBar (Step 4 Unified Header sprint).
 * На desktop (lg+) сверху рендерится slim AppHeader (h-12) для поддержания
 * визуальной целостности super-app. На mobile — thread остаётся полноэкранным,
 * StickyChatHeader сам владеет верхней зоной.
 */

import { UNIFIED_HEADER_ENABLED } from '@/lib/feature-flags'
import { ChatTopBar } from '@/components/app-header/ChatTopBar'

export function MessagesViewportShell({ children }) {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-white">
      {UNIFIED_HEADER_ENABLED && <ChatTopBar />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
