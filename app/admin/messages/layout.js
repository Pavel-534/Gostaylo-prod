'use client'

/**
 * Фиксированная высота области сообщений: лента скроллится внутри ChatThreadChrome,
 * а не вся страница админки (мобиле: под фиксированным header ~3.5rem).
 */
export default function AdminMessagesLayout({ children }) {
  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden max-lg:min-h-[calc(100dvh-3.5rem)] max-lg:max-h-[calc(100dvh-3.5rem)] lg:min-h-[min(720px,calc(100vh-9rem))] lg:max-h-[calc(100vh-9rem)]">
      {children}
    </div>
  )
}
