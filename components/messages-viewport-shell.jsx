'use client'

/**
 * Каркас высоты dvh для /messages. Нижний таббар на холле и в треде скрыт — отступ не нужен.
 */
export function MessagesViewportShell({ children }) {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
