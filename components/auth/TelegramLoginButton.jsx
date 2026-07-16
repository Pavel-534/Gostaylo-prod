'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/i18n-context'
import { getAuthErrorMessage } from '@/lib/translations'
import { finishAuthNavigation } from '@/lib/auth/auth-redirect'
import { getTelegramBotUsername } from '@/lib/telegram-bot-public'
import { useAuth } from '@/contexts/auth-context'

/**
 * Stage 189.0 / 189.3 — Telegram Login Widget (auth screens only; profile uses deep-link).
 */
export function TelegramLoginButton({ requireLegalConsent = false, legalConsent = true, onLegalRequired }) {
  const containerRef = useRef(null)
  const router = useRouter()
  const { language } = useI18n()
  const { refreshUserFromServer } = useAuth()
  const botUsername = getTelegramBotUsername()

  const onTelegramAuth = useCallback(
    async (user) => {
      if (requireLegalConsent && !legalConsent) {
        onLegalRequired?.()
        return
      }
      try {
        const res = await fetch('/api/v2/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...user,
            acceptedLegalTerms: requireLegalConsent ? legalConsent : false,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          toast.error(getAuthErrorMessage(json.error_code, language))
          return
        }
        await refreshUserFromServer()
        if (json.user) {
          try {
            localStorage.setItem('gostaylo_user', JSON.stringify(json.user))
          } catch {
            /* ignore */
          }
        }
        finishAuthNavigation(router)
      } catch {
        toast.error(getAuthErrorMessage('AUTH_INTERNAL', language))
      }
    },
    [requireLegalConsent, legalConsent, onLegalRequired, language, refreshUserFromServer, router],
  )

  useEffect(() => {
    if (!botUsername || !containerRef.current) return undefined

    window.onTelegramAuth = onTelegramAuth

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
      try {
        delete window.onTelegramAuth
      } catch {
        window.onTelegramAuth = undefined
      }
    }
  }, [botUsername, onTelegramAuth])

  if (!botUsername) return null

  return (
    <div className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200/90 bg-white px-2 py-1 shadow-sm">
      <div ref={containerRef} className="flex min-h-12 items-center justify-center [&_iframe]:!min-h-12" />
    </div>
  )
}

export default TelegramLoginButton
