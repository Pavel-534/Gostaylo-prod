/**
 * Единый каркас /messages и /messages/[id]: фиксированная высота viewport (dvh),
 * без скролла документа — только внутренние области (список / лента).
 * На мобиле резервируем место под фиксированный MobileBottomNav + safe-area.
 */
export const metadata = {
  title: 'Сообщения | Gostaylo',
  description: 'Диалоги с гостями и хозяевами в одном месте',
}

export default function MessagesLayout({ children }) {
  return (
    <div
      className={
        'flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-slate-50 ' +
        'max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
