import { redirect } from 'next/navigation'

/**
 * Deep link alias for mobile / push / Telegram: opens the in-app messages thread.
 * Canonical route remains /messages/[id].
 */
export default async function ChatDeepLinkPage({ params }) {
  const { id } = await params
  if (!id) redirect('/messages')
  redirect(`/messages/${encodeURIComponent(id)}`)
}
