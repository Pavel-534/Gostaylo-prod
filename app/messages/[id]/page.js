/**
 * Универсальный тред переписки: /messages/[id]
 */
import UnifiedMessagesClient from './UnifiedMessagesClient'

export const metadata = {
  title: 'Сообщения | Gostaylo',
}

export default function MessagesThreadPage({ params }) {
  return <UnifiedMessagesClient params={params} />
}
