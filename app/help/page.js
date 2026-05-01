import { redirect } from 'next/navigation'

/**
 * /help — редиректит на /help/escrow-protection пока не готова полная страница.
 * TODO: Заменить на полноценный Help Center.
 */
export default function HelpPage() {
  redirect('/help/escrow-protection')
}
