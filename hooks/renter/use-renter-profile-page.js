'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { signOut } from '@/lib/auth'
import {
  calculateProfileCompletion,
  getProfileCompletionItems,
} from '@/lib/renter/profile-completion'
import {
  fetchPartnerApplicationStatus,
  submitPartnerApplication,
  patchPartnerApplicationKyc,
} from '@/lib/renter/renter-profile-api-client'

/**
 * Stage 111.0 — логика страницы профиля арендатора.
 * Stage 200.132 — no auth-change → refresh loop (apply event.detail only).
 * Stage 202.8 — `?becomePartner=1` opens application modal (home PartnerCTA).
 */
export function useRenterProfilePage() {
  const router = useRouter()
  const { language } = useI18n()
  const { user: authUser, loading: authLoading, refreshUserFromServer } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applicationStatus, setApplicationStatus] = useState(null)
  const [loadingApplication, setLoadingApplication] = useState(false)
  const [telegramLinked, setTelegramLinked] = useState(false)
  const partnerAppHydratedForUserId = useRef(null)
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [pendingKycUrl, setPendingKycUrl] = useState(null)
  const [savingPendingKyc, setSavingPendingKyc] = useState(false)
  const softRefreshDoneForUserId = useRef(null)
  const becomePartnerOpenedRef = useRef(false)

  const dateLocale = { ru, en: enUS, zh: zhCN, th: thLocale }[language] || enUS

  const applyUser = useCallback((u) => {
    if (!u) {
      setUser(null)
      setTelegramLinked(false)
      return
    }
    setUser(u)
    setTelegramLinked(!!(u.telegram_id || u.telegram_username))
  }, [])

  // Hydrate from AuthProvider first — avoid spinner while /me is in flight
  useEffect(() => {
    if (authLoading) return
    applyUser(authUser || null)
    setLoading(false)
  }, [authLoading, authUser, applyUser])

  // One soft refresh per user id (session sync already owns gostaylo-refresh-session)
  useEffect(() => {
    if (authLoading) return
    if (!authUser?.id) {
      softRefreshDoneForUserId.current = null
      return
    }
    if (softRefreshDoneForUserId.current === authUser.id) return
    softRefreshDoneForUserId.current = authUser.id
    let cancelled = false
    void refreshUserFromServer().then((u) => {
      if (cancelled) return
      // undefined = transient failure — keep authUser; null = logged out
      if (u !== undefined) applyUser(u)
    })
    return () => {
      cancelled = true
    }
  }, [authLoading, authUser?.id, refreshUserFromServer, applyUser])

  // Apply auth-change detail only — never re-call refresh (infinite loop → logout)
  useEffect(() => {
    const onAuthChange = (e) => {
      applyUser(e?.detail ?? null)
    }
    window.addEventListener('auth-change', onAuthChange)
    return () => {
      window.removeEventListener('auth-change', onAuthChange)
    }
  }, [applyUser])

  const loadPartnerApplicationStatus = useCallback(async (userId, { silent = false } = {}) => {
    if (!userId) return
    if (!silent) setLoadingApplication(true)
    try {
      const { data } = await fetchPartnerApplicationStatus()
      if (data.success && data.hasApplication) {
        setApplicationStatus({
          status: data.status,
          rejection_reason: data.rejectionReason,
          created_at: data.appliedAt,
          reviewed_at: data.reviewedAt,
          hasVerificationDoc: !!data.hasVerificationDoc,
        })
      } else {
        setApplicationStatus(null)
      }
      partnerAppHydratedForUserId.current = userId
    } catch (error) {
      console.error('[PROFILE] Failed to fetch application status', error)
    } finally {
      if (!silent) setLoadingApplication(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.id || user.role === 'PARTNER') {
      setApplicationStatus(null)
      setLoadingApplication(false)
      partnerAppHydratedForUserId.current = null
      return
    }
    const uid = user.id
    const silent = partnerAppHydratedForUserId.current === uid
    void loadPartnerApplicationStatus(uid, { silent })
  }, [user?.id, user?.role, loadPartnerApplicationStatus])

  // Stage 202.8 — home PartnerCTA lands with ?becomePartner=1
  useEffect(() => {
    if (becomePartnerOpenedRef.current) return
    if (typeof window === 'undefined') return
    const want =
      new URLSearchParams(window.location.search).get('becomePartner') === '1'
    if (!want) return
    if (loading || !user?.id) return
    if (String(user.role || '').toUpperCase() === 'PARTNER') {
      router.replace('/partner/dashboard')
      return
    }
    becomePartnerOpenedRef.current = true
    setShowApplicationModal(true)
    router.replace('/renter/profile', { scroll: false })
  }, [loading, user?.id, user?.role, router])

  const handleApplicationSubmit = useCallback(
    async (formData) => {
      setSubmittingApplication(true)
      try {
        const { ok, data } = await submitPartnerApplication({
          phone: formData.phone,
          experience: formData.experience,
          socialLink: formData.socialLink,
          portfolio: formData.portfolio,
          verificationDocUrl: formData.verificationDocUrl,
          acceptedPartnerTerms: true,
        })
        if (ok && data.success) {
          toast.success(getUIText('renterToastApplicationSubmitted', language))
          setShowApplicationModal(false)
          await loadPartnerApplicationStatus(user.id, { silent: true })
        } else {
          toast.error(data.error || getUIText('renterToastApplicationFailed', language))
        }
      } catch (error) {
        console.error('[APPLICATION] Submit error', error)
        toast.error(getUIText('renterToastApplicationSubmitError', language))
      } finally {
        setSubmittingApplication(false)
      }
    },
    [language, user?.id, loadPartnerApplicationStatus],
  )

  const handleSavePendingKyc = useCallback(async () => {
    const doc = String(pendingKycUrl || '').trim()
    if (!doc) {
      toast.error(getUIText('partnerPendingKycDocRequired', language))
      return
    }
    setSavingPendingKyc(true)
    try {
      const { ok, data } = await patchPartnerApplicationKyc(doc)
      if (!ok || !data.success) {
        throw new Error(data.error || getUIText('partnerPendingKycSaveErr', language))
      }
      toast.success(getUIText('partnerPendingKycSaved', language))
      setPendingKycUrl(null)
      await loadPartnerApplicationStatus(user.id, { silent: true })
    } catch (e) {
      console.error('[PROFILE] PATCH KYC', e)
      toast.error(e.message || getUIText('partnerPendingKycSaveErr', language))
    } finally {
      setSavingPendingKyc(false)
    }
  }, [pendingKycUrl, language, user?.id, loadPartnerApplicationStatus])

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/')
  }, [router])

  const profileCompletion = useMemo(() => calculateProfileCompletion(user), [user])
  const profileItems = useMemo(() => getProfileCompletionItems(user), [user])

  return {
    language,
    user,
    loading,
    applicationStatus,
    loadingApplication,
    telegramLinked,
    showApplicationModal,
    setShowApplicationModal,
    submittingApplication,
    pendingKycUrl,
    setPendingKycUrl,
    savingPendingKyc,
    dateLocale,
    handleApplicationSubmit,
    handleSavePendingKyc,
    handleLogout,
    profileCompletion,
    profileItems,
  }
}
