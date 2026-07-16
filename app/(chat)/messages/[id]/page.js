/**
 * Универсальный тред переписки: /messages/[id]
 */
import UnifiedMessagesClient from './UnifiedMessagesClient'
import { getSiteDisplayName } from '@/lib/site-url'

export async function generateMetadata() {
  const brand = getSiteDisplayName()
  return {
    title: `Сообщения | ${brand}`,
  }
}

export default function MessagesThreadPage({ params }) {
  return <UnifiedMessagesClient params={params} />
}
