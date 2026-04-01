/**
 * Единый адрес From для Resend (в .env встречались и EMAIL_FROM, и FROM_EMAIL).
 */
export function getTransactionalFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    'GoStayLo <booking@gostaylo.com>'
  )
}
