import { buildDefaultFromAddress } from '@/lib/site-url'

/**
 * Единый адрес From для Resend (в .env: EMAIL_FROM или FROM_EMAIL).
 */
export function getTransactionalFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    buildDefaultFromAddress('booking')
  )
}

/**
 * Noreply для системных писем (admin/partners и т.д.).
 * Env: NOREPLY_FROM → иначе booking@ → иначе SSOT noreply@{getSiteEmailDomain()}.
 */
export function getNoreplyFromAddress() {
  return (
    process.env.NOREPLY_FROM ||
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    buildDefaultFromAddress('noreply')
  )
}
