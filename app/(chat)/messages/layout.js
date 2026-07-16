/**
 * Chat + messenger i18n loaded in `(chat)/layout.js` (Stage 171.31).
 */
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
