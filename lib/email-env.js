import { getSiteDisplayName } from '@/lib/site-url'

/**
 * Единый адрес From для Resend (в .env встречались и EMAIL_FROM, и FROM_EMAIL).
 */
export function getTransactionalFromAddress() {
  const name = getSiteDisplayName()
  return (
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    `${name} <booking@gostaylo.com>`
  )
}
