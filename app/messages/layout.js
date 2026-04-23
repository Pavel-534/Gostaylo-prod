/**
 * Каркас сообщений: фиксированный dvh, условный отступ под нижнюю навигацию (только холл).
 */
import '@/lib/translations/register-chat-slice'
import { MessagesViewportShell } from '@/components/messages-viewport-shell'

export const metadata = {
  title: 'Сообщения | GoStayLo',
  description: 'Диалоги с гостями и хозяевами в одном месте',
}

export default function MessagesLayout({ children }) {
  return <MessagesViewportShell>{children}</MessagesViewportShell>
}
