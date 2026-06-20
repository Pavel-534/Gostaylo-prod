'use client'

/**
 * Каркас высоты dvh для /messages. Нижний таббар на холле и в треде скрыт — отступ не нужен.
 *
 * Stage 170.8: VisualViewport — динамическая высота при мобильной клавиатуре (iOS/Android).
 *
 * 2026-02-05: интеграция единого ChatTopBar (Step 4 Unified Header sprint).
 * На desktop (lg+) сверху рендерится slim AppHeader (h-12) для поддержания
 * визуальной целостности super-app. На mobile — thread остаётся полноэкранным,
 * StickyChatHeader сам владеет верхней зоной.
 */

import { useEffect, useState } from 'react'
import { ChatTopBar } from '@/components/app-header/ChatTopBar'

export function MessagesViewportShell({ children }) {
  const [viewportHeight, setViewportHeight] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    const syncViewportHeight = () => {
      setViewportHeight(vv.height)
    }

    syncViewportHeight()
    vv.addEventListener('resize', syncViewportHeight)

    return () => {
      vv.removeEventListener('resize', syncViewportHeight)
    }
  }, [])

  return (
    <div
      className="flex max-h-dvh min-h-0 flex-col overflow-hidden bg-white"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      <ChatTopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
