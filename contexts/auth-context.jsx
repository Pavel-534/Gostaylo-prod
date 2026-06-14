/**
 * GoStayLo - Global Auth Context
 * Сессия: HttpOnly-кука `gostaylo_session` выставляется только сервером (login/verify);
 * SameSite=Lax и Secure (на production) задаются в API — домен не фиксируется, работает .ru / .com.
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';
import { useI18n } from '@/contexts/i18n-context';
import { AuthModalShell } from '@/components/auth/modals/AuthModalShell';
import { useAuthSessionSync } from '@/contexts/auth/auth-session-sync';
import {
  useReferralCapture,
  PENDING_REF_LS,
  readPendingRefFromCookie,
} from '@/contexts/auth/auth-referral-handler';
import { useAuthModalLogic } from '@/contexts/auth/auth-modal-logic';
import { useAuthActions } from '@/contexts/auth/auth-actions';

const AuthContext = createContext(null);

function normalizeAuthUser(u) {
  if (!u || typeof u !== 'object') return u;
  const first_name = u.first_name ?? u.firstName ?? '';
  const last_name = u.last_name ?? u.lastName ?? '';
  const name =
    (u.name && String(u.name).trim()) ||
    `${first_name} ${last_name}`.trim() ||
    u.email ||
    '';
  const legalTs = u.legalTermsAcceptedAt ?? u.legal_terms_accepted_at ?? null;
  const termsAcceptedAt = u.termsAcceptedAt ?? u.terms_accepted_at ?? legalTs ?? null;
  const termsAccepted =
    u.termsAccepted === true ||
    u.terms_accepted === true ||
    Boolean(termsAcceptedAt);
  return {
    ...u,
    first_name,
    last_name,
    firstName: u.firstName ?? first_name,
    lastName: u.lastName ?? last_name,
    name,
    termsAccepted,
    terms_accepted: termsAccepted,
    termsAcceptedAt,
    terms_accepted_at: termsAcceptedAt,
    legalTermsAcceptedAt: legalTs,
    legal_terms_accepted_at: legalTs,
  };
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistOAuthLegalCookie = useCallback((accept) => {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:';
    if (accept) {
      document.cookie = `gostaylo_oauth_legal=1; Path=/; Max-Age=600; SameSite=Lax${secure ? '; Secure' : ''}`;
    } else {
      document.cookie = `gostaylo_oauth_legal=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`;
    }
  }, []);

  const {
    loginModalOpen,
    setLoginModalOpen,
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
    registerAuthModalOnClose,
    handleLoginModalOpenChange,
  } = useAuthModalLogic({
    readPendingRefFromCookie,
    pendingRefLsKey: PENDING_REF_LS,
    persistOAuthLegalCookie,
  });

  const {
    startGoogleOAuth,
    handleLogin,
    handleRegister,
    validatePromoCode,
    handleForgotPassword,
  } = useAuthActions({
    authMode,
    registerLegalConsent,
    language,
    pathname,
    router,
    persistOAuthLegalCookie,
    email,
    password,
    name,
    promoCode,
    closeLoginModal,
    setAuthMode,
    setError,
    setSubmitting,
    setGoogleOAuthBusy,
    setVerificationEmail,
    setUser,
    normalizeAuthUser,
    setPromoStatus,
    setPromoMessage,
    setPromoCode,
    setForgotPasswordSent,
  });

  const { refreshUserFromServer } = useAuthSessionSync({
    setUser,
    setLoading,
    normalizeAuthUser,
    getCurrentUser,
  });

  /** Выйти из client-side имперсонации (восстановить админа из localStorage). */
  const returnToAdmin = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('gostaylo_original_admin');
      if (raw) {
        const admin = normalizeAuthUser(JSON.parse(raw));
        localStorage.removeItem('gostaylo_original_admin');
        localStorage.setItem('gostaylo_user', JSON.stringify(admin));
        setUser(admin);
        window.dispatchEvent(new CustomEvent('auth-change', { detail: admin }));
        window.location.href = '/admin/dashboard';
        return;
      }
    } catch {
      /* ignore */
    }
    void refreshUserFromServer().then(() => {
      window.location.href = '/admin/dashboard';
    });
  }, [normalizeAuthUser, refreshUserFromServer]);

  useReferralCapture({
    language,
    setPromoCode,
    setPromoStatus,
    setPromoMessage,
  });

  // Если согласие уже зафиксировано, не держим пользователя на `/auth/complete-legal/`.
  useEffect(() => {
    if (!user || !pathname?.startsWith('/auth/complete-legal')) return;
    const accepted =
      user.termsAccepted === true ||
      user.terms_accepted === true ||
      Boolean(user.termsAcceptedAt || user.terms_accepted_at || user.legalTermsAcceptedAt || user.legal_terms_accepted_at);
    if (accepted) {
      router.replace('/profile/');
    }
  }, [pathname, router, user]);

  /** После accept-legal на `/auth/complete-legal/` — закрыть модалку входа, если она была открыта. */
  useEffect(() => {
    const onCloseAuthModal = () => {
      closeLoginModal('success');
      void refreshUserFromServer();
    };
    window.addEventListener('gostaylo-close-auth-modal', onCloseAuthModal);
    return () => window.removeEventListener('gostaylo-close-auth-modal', onCloseAuthModal);
  }, [refreshUserFromServer, closeLoginModal]);


  /** Автофокус первого поля при открытии модалки / смене вкладки (язык — только `useI18n().language`). */
  useEffect(() => {
    if (!loginModalOpen) return;
    const id = window.requestAnimationFrame(() => {
      if (authMode === 'verification_pending') {
        document.getElementById('auth-verify-email-field')?.focus();
      } else if (authMode === 'register') {
        document.getElementById('auth-name')?.focus();
      } else if (authMode === 'login') {
        document.getElementById('auth-email')?.focus();
      } else if (authMode === 'forgot_password') {
        document.getElementById('forgot-email')?.focus();
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [loginModalOpen, authMode]);


  // Logout handler
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: null }));
    window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'));
    router.push('/');
  }, [router]);

  // Update user
  const updateUser = useCallback((updatedUser) => {
    const normalized = normalizeAuthUser(updatedUser);
    setUser(normalized);
    localStorage.setItem('gostaylo_user', JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('auth-change', { detail: normalized }));
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isPartner: user?.role === 'PARTNER' || user?.role === 'ADMIN', // Admin is also a super-partner
    isModerator: user?.role === 'MODERATOR',
    isRenter: user?.role === 'RENTER' || !user?.role,
    // Helper: can user access partner features?
    canAccessPartner: user?.role === 'PARTNER' || user?.role === 'ADMIN' || user?.role === 'MODERATOR',
    loginModalOpen,
    openLoginModal,
    closeLoginModal,
    registerAuthModalOnClose,
    logout,
    updateUser,
    refreshUserFromServer,
    returnToAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}

      <AuthModalShell
        language={language}
        loginModalOpen={loginModalOpen}
        onLoginModalOpenChange={handleLoginModalOpenChange}
        authMode={authMode}
        setAuthMode={setAuthMode}
        verificationEmail={verificationEmail}
        forgotPasswordSent={forgotPasswordSent}
        setForgotPasswordSent={setForgotPasswordSent}
        registerLegalConsent={registerLegalConsent}
        setRegisterLegalConsent={setRegisterLegalConsent}
        submitting={submitting}
        googleOAuthBusy={googleOAuthBusy}
        startGoogleOAuth={startGoogleOAuth}
        setError={setError}
        loginProps={{
          language,
          email,
          setEmail,
          password,
          setPassword,
          showPassword,
          setShowPassword,
          submitting,
          error,
          onSubmit: handleLogin,
          onForgotPassword: () => {
            setAuthMode('forgot_password')
            setError('')
            setForgotPasswordSent(false)
          },
        }}
        registerProps={{
          language,
          submitting,
          error,
          name,
          setName,
          promoCode,
          setPromoCode,
          promoStatus,
          setPromoStatus,
          promoMessage,
          setPromoMessage,
          validatePromoCode,
          email,
          setEmail,
          password,
          setPassword,
          showPassword,
          setShowPassword,
          registerLegalConsent,
          setRegisterLegalConsent,
          onSubmit: handleRegister,
        }}
        resetProps={{
          language,
          email,
          setEmail,
          error,
          submitting,
          forgotPasswordSent,
          setForgotPasswordSent,
          setAuthMode,
          onSubmit: handleForgotPassword,
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
