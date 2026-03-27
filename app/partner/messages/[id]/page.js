/**
 * Временный редирект на единый тред (Этап 2).
 */
import { redirect } from 'next/navigation'

export default function PartnerMessagesThreadRedirect({ params }) {
  const id = params?.id
  if (!id) redirect('/messages')
  redirect(`/messages/${encodeURIComponent(id)}`)
}
