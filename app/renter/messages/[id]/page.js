/**
 * Renter Messages — thin Next.js page router.
 *
 * Вся логика данных и UI находится в RenterMessagesClient.jsx.
 * Этот файл — только точка входа для Next.js App Router.
 */
import RenterMessagesClient from './RenterMessagesClient'

export const metadata = {
  title: 'Сообщения | Gostaylo',
}

export default function RenterMessagesPage({ params }) {
  return <RenterMessagesClient params={params} />
}
