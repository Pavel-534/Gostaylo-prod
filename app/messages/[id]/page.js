/**
 * Универсальный тред переписки: /messages/[id]
 */
import UnifiedMessagesClient from './UnifiedMessagesClient'

export const metadata = {
  title: 'Сообщения | GoStayLo',
}

export default function MessagesThreadPage({ params }) {
  return <UnifiedMessagesClient params={params} />
}
