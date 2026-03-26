/**
 * Partner Messages — thin Next.js page router.
 *
 * Вся логика данных и UI находится в PartnerMessagesClient.jsx.
 * Этот файл — только точка входа для Next.js App Router.
 */
import PartnerMessagesClient from './PartnerMessagesClient'

export const metadata = {
  title: 'Сообщения — Партнёр | Gostaylo',
}

export default function PartnerMessagesPage({ params }) {
  return <PartnerMessagesClient params={params} />
}
