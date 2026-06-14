'use client'

/**
 * Stage 140.3 — Supabase Realtime sync for partner cabinet.
 * Subscribes to bookings + wallet_transactions; invalidates TanStack Query caches.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'
import { partnerStatsKeys } from '@/lib/hooks/use-partner-stats'
import { partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { partnerCalendarKeys } from '@/lib/hooks/use-partner-calendar'
import { queryKeys } from '@/lib/query-keys'
import {
  mapBookingRowToNotification,
  mapWalletRowToNotification,
} from '@/lib/partner/partner-notification-events'

const INVALIDATE_DEBOUNCE_MS = 400

/**
 * @param {string | null | undefined} partnerId
 * @param {{ enabled?: boolean, language?: string, onPartnerEvent?: (payload: object) => void }} [options]
 */
export function usePartnerRealtime(partnerId, options = {}) {
  const { enabled = true, language = 'ru', onPartnerEvent } = options
  const queryClient = useQueryClient()
  const onEventRef = useRef(onPartnerEvent)
  const debounceRef = useRef(null)
  const bookingStatusRef = useRef(new Map())

  useEffect(() => {
    onEventRef.current = onPartnerEvent
  }, [onPartnerEvent])

  const invalidatePartnerQueries = useCallback(() => {
    if (!partnerId) return
    const pid = String(partnerId)
    void queryClient.invalidateQueries({ queryKey: partnerStatsKeys.data(pid) })
    void queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
    void queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.all })
    void queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['partner-finances-summary', pid] })
    void queryClient.invalidateQueries({ queryKey: ['partner-balance-breakdown', pid] })
    void queryClient.invalidateQueries({ queryKey: ['partner-payout-preview', pid] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me(pid) })
    void queryClient.invalidateQueries({ queryKey: ['wallet-me'] })
  }, [partnerId, queryClient])

  const scheduleInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      invalidatePartnerQueries()
    }, INVALIDATE_DEBOUNCE_MS)
  }, [invalidatePartnerQueries])

  const emitEvent = useCallback(
    (payload) => {
      onEventRef.current?.(payload)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gostaylo:partner-event', { detail: payload }))
      }
    },
    [],
  )

  useEffect(() => {
    if (!enabled || !partnerId || !supabase) return undefined

    const pid = String(partnerId)

    const stop = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: `partner-sync:${pid}`,
      createChannel: (attempt) => {
        const ch = supabase.channel(`partner-sync:${pid}:${attempt}`)

        ch.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: `partner_id=eq.${pid}`,
          },
          (payload) => {
            const row = payload.new
            if (row?.id) bookingStatusRef.current.set(String(row.id), String(row.status || ''))
            scheduleInvalidate()
            const notif = mapBookingRowToNotification(row, { event: 'INSERT', language })
            if (notif) emitEvent({ source: 'realtime', table: 'bookings', event: 'INSERT', row, notif })
          },
        )

        ch.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings',
            filter: `partner_id=eq.${pid}`,
          },
          (payload) => {
            const row = payload.new
            const id = String(row?.id || '')
            const previousStatus = bookingStatusRef.current.get(id) || ''
            if (id) bookingStatusRef.current.set(id, String(row.status || ''))
            scheduleInvalidate()
            const notif = mapBookingRowToNotification(row, {
              event: 'UPDATE',
              previousStatus,
              language,
            })
            if (notif) {
              emitEvent({
                source: 'realtime',
                table: 'bookings',
                event: 'UPDATE',
                row,
                previousStatus,
                notif,
              })
            }
          },
        )

        ch.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'wallet_transactions',
            filter: `user_id=eq.${pid}`,
          },
          (payload) => {
            scheduleInvalidate()
            const notif = mapWalletRowToNotification(payload.new, { language })
            if (notif) {
              emitEvent({
                source: 'realtime',
                table: 'wallet_transactions',
                event: 'INSERT',
                row: payload.new,
                notif,
              })
            }
          },
        )

        return ch
      },
    })

    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      invalidatePartnerQueries()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }

    return () => {
      stop()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [enabled, partnerId, language, scheduleInvalidate, invalidatePartnerQueries, emitEvent])
}
