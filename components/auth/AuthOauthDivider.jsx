'use client'

import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/** Stage 189 — OAuth section divider (no CSS uppercase — ruins RU/CJK). */
export function AuthOauthDivider() {
  const { language } = useI18n()
  return (
    <div className="relative py-1">
      <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden />
      <p className="relative mx-auto w-fit bg-slate-50 px-3 text-center text-xs font-medium tracking-wide text-slate-400">
        {getUIText('auth_oauthDivider', language)}
      </p>
    </div>
  )
}

export default AuthOauthDivider
