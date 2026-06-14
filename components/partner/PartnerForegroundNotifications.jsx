'use client'

/**
 * Stage 140.3 — Foreground toasts for partner-critical events (push + realtime).
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import {
  mapPushPayloadToNotification,
  PARTNER_NOTIF_KIND,
} from '@/lib/partner/partner-notification-events'

const TOAST_KINDS = new Set([
  PARTNER_NOTIF_KIND.NEW_BOOKING,
  PARTNER_NOTIF_KIND.PAYMENT_RECEIVED,
  PARTNER_NOTIF_KIND.WALLET_CREDIT,
])

const DEDUPE_MS = 5000
const recentKeys = new Map()

function shouldShowToast(notif) {
  if (!notif || !TOAST_KINDS.has(notif.kind)) return false
  const key = `${notif.kind}:${notif.meta?.bookingId || notif.id}`
  const now = Date.now()
  const last = recentKeys.get(key)
  if (last && now - last < DEDUPE_MS) return false
  recentKeys.set(key, now)
  return true
}

export function PartnerForegroundNotifications() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { language } = useI18n()
  const partnerIdRef = useRef(user?.id)

  useEffect(() => {
    partnerIdRef.current = user?.id
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined
    const allowedRoles = ['PARTNER', 'ADMIN', 'MODERATOR']
    if (!allowedRoles.includes(String(user?.role || '').toUpperCase())) return undefined

    function showToast(notif) {
      if (!shouldShowToast(notif)) return
      toast(notif.title, {
        description: notif.body,
        duration: 8000,
        action: notif.href
          ? {
              label: getUIText('partnerNotif_toastOpen', language),
              onClick: () => router.push(notif.href),
            }
          : undefined,
      })
    }

    const onPush = (evt) => {
      const notif = mapPushPayloadToNotification(evt?.detail || {}, language)
      if (notif) showToast(notif)
    }

    const onPartnerEvent = (evt) => {
      const notif = evt?.detail?.notif
      if (notif) showToast(notif)
    }

    window.addEventListener('gostaylo:push-message', onPush)
    window.addEventListener('gostaylo:partner-event', onPartnerEvent)
    return () => {
      window.removeEventListener('gostaylo:push-message', onPush)
      window.removeEventListener('gostaylo:partner-event', onPartnerEvent)
    }
  }, [isAuthenticated, user?.id, user?.role, language, router])

  return null
}
