'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAuthModalState } from '@/hooks/useAuthModalState'

/**
 * Stage 143 — shared dismiss-follow-up for referral register modal (catalog, PDP, /u/[id]).
 */
export function useReferralModalFollowup() {
  const { user, openLoginModal } = useAuth()
  const [showFollowupBanner, setShowFollowupBanner] = useState(false)
  const promptedAuthRef = useRef(false)

  useAuthModalState({
    onClose: (outcome) => {
      if (outcome === 'dismiss' && promptedAuthRef.current) {
        setShowFollowupBanner(true)
      }
      if (outcome === 'success') {
        promptedAuthRef.current = false
        setShowFollowupBanner(false)
      }
    },
  })

  useEffect(() => {
    if (user?.id) {
      setShowFollowupBanner(false)
      promptedAuthRef.current = false
    }
  }, [user?.id])

  const promptRegisterForReferral = useCallback(() => {
    promptedAuthRef.current = true
    setShowFollowupBanner(false)
    openLoginModal('register')
  }, [openLoginModal])

  return {
    showFollowupBanner,
    setShowFollowupBanner,
    promptRegisterForReferral,
    promptedAuthRef,
  }
}
