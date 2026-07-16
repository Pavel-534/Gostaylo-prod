'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AUTH_CLOSE_EVENT } from '@/lib/auth/auth-redirect'

/** @typedef {'success' | 'dismiss'} AuthModalCloseOutcome */

export function useAuthModalLogic({
  readPendingRefFromCookie,
  pendingRefLsKey,
  persistOAuthLegalCookie,
}) {
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const closeListenersRef = useRef(new Set())
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState('idle')
  const [promoMessage, setPromoMessage] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)
  const [registerLegalConsent, setRegisterLegalConsent] = useState(false)
  const [googleOAuthBusy, setGoogleOAuthBusy] = useState(false)

  const emitAuthModalClose = useCallback((outcome) => {
    for (const listener of closeListenersRef.current) {
      try {
        listener(outcome)
      } catch {
        /* ignore subscriber errors */
      }
    }
  }, [])

  useEffect(() => {
    const onAuthClose = (event) => {
      const outcome = event?.detail?.outcome === 'dismiss' ? 'dismiss' : 'success'
      emitAuthModalClose(outcome)
    }
    window.addEventListener(AUTH_CLOSE_EVENT, onAuthClose)
    return () => window.removeEventListener(AUTH_CLOSE_EVENT, onAuthClose)
  }, [emitAuthModalClose])

  const registerAuthModalOnClose = useCallback((listener) => {
    if (typeof listener !== 'function') return () => {}
    closeListenersRef.current.add(listener)
    return () => {
      closeListenersRef.current.delete(listener)
    }
  }, [])

  const openLoginModal = useCallback(
    (mode) => {
      persistOAuthLegalCookie(false)
      const actualMode = typeof mode === 'string' ? mode : 'login'
      setAuthMode(actualMode)
      setEmail('')
      setPassword('')
      setName('')
      try {
        const persisted =
          readPendingRefFromCookie() ||
          (typeof window !== 'undefined' ? localStorage.getItem(pendingRefLsKey)?.trim() : '')
        if (persisted) {
          setPromoCode(String(persisted).trim().toUpperCase())
        } else {
          setPromoCode('')
        }
        setPromoStatus('idle')
        setPromoMessage('')
      } catch {
        setPromoCode('')
        setPromoStatus('idle')
        setPromoMessage('')
      }
      setError('')
      setRegisterLegalConsent(false)
      setLoginModalOpen(true)
    },
    [persistOAuthLegalCookie, readPendingRefFromCookie, pendingRefLsKey],
  )

  const closeLoginModal = useCallback(
    (outcome = 'dismiss') => {
      setLoginModalOpen(false)
      setError('')
      setAuthMode('login')
      emitAuthModalClose(outcome)
    },
    [emitAuthModalClose],
  )

  /** Radix Dialog `onOpenChange` — only handles user dismiss (overlay / Esc). */
  const handleLoginModalOpenChange = useCallback(
    (open) => {
      if (open) {
        setLoginModalOpen(true)
        return
      }
      if (loginModalOpen) closeLoginModal('dismiss')
    },
    [loginModalOpen, closeLoginModal],
  )

  return {
    loginModalOpen,
    setLoginModalOpen,
    handleLoginModalOpenChange,
    registerAuthModalOnClose,
    authMode,
    setAuthMode,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    showPassword,
    setShowPassword,
    submitting,
    setSubmitting,
    error,
    setError,
    promoCode,
    setPromoCode,
    promoStatus,
    setPromoStatus,
    promoMessage,
    setPromoMessage,
    verificationEmail,
    setVerificationEmail,
    forgotPasswordSent,
    setForgotPasswordSent,
    registerLegalConsent,
    setRegisterLegalConsent,
    googleOAuthBusy,
    setGoogleOAuthBusy,
    openLoginModal,
    closeLoginModal,
  }
}
