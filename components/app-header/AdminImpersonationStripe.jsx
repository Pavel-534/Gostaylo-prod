'use client'

/**
 * AdminImpersonationStripe — тонкая красная полоса сверху хедера.
 * Заменяет dark-gradient admin header: не ломает zen, но чётко маркирует режим.
 *
 * Показывается ТОЛЬКО если user.is_impersonating === true
 * (проставляется auth-context когда админ входит «под пользователем»).
 */

import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { ArrowLeft } from 'lucide-react'
import { getUIText } from '@/lib/translations'

export function AdminImpersonationStripe() {
  const { user, returnToAdmin } = useAuth()
  const { language } = useI18n()

  if (!user?.is_impersonating) return null

  const handleReturn = () => {
    if (typeof returnToAdmin === 'function') returnToAdmin()
    else if (typeof window !== 'undefined') window.location.href = '/admin'
  }

  return (
    <div
      data-testid="admin-impersonation-stripe"
      className="flex items-center justify-between gap-2 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-white shadow-[0_2px_8px_rgba(225,29,72,0.3)]"
    >
      <span className="truncate">
        👁 {language === 'ru' ? 'Режим имперсонации' : 'Impersonation mode'}
        <span className="mx-1.5 opacity-70">·</span>
        <span className="font-medium opacity-95">{user.name || user.email}</span>
      </span>
      <button
        type="button"
        onClick={handleReturn}
        data-testid="admin-impersonation-return"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-rose-700 shadow-sm transition-all hover:bg-white hover:shadow"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden />
        {getUIText('partnerLayout_back', language) || (language === 'ru' ? 'Назад' : 'Back')}
      </button>
    </div>
  )
}

export default AdminImpersonationStripe
