/**
 * Каркас сообщений: фиксированный dvh, условный отступ под нижнюю навигацию (только холл).
 */
import '@/lib/translations/register-chat-slice'
import { MessagesViewportShell } from '@/components/messages-viewport-shell'
import { getSiteDisplayName } from '@/lib/site-url'

export async function generateMetadata() {
  const brand = getSiteDisplayName()
  return {
    title: `Сообщения | ${brand}`,
    description: 'Диалоги с гостями и хозяевами в одном месте',
  }
}

export default function MessagesLayout({ children }) {
  return <MessagesViewportShell>{children}</MessagesViewportShell>
}
