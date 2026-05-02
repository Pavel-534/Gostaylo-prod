/**
 * GoStayLo - Global Auth Context
 * Сессия: HttpOnly-кука `gostaylo_session` выставляется только сервером (login/verify);
 * SameSite=Lax и Secure (на production) задаются в API — домен не фиксируется, работает .ru / .com.
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';
import { signIn, signUp, getCurrentUser, signOut } from '@/lib/auth';
import { toast } from 'sonner';
import { getSiteDisplayName } from '@/lib/site-url';
import { useI18n } from '@/contexts/i18n-context';
import { getUIText } from '@/lib/translations';
import { LegalConsentCheckboxRow } from '@/components/legal/LegalConsentCheckboxRow';
import { getOAuthBrowserSupabase } from '@/lib/supabase/oauth-browser-client';

function GoogleBrandGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleBrandGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.395-1.29-3.428-2.62-1.257-1.72-2.394-4.54-2.394-8.005 0-3.64 2.394-6.53 5.47-6.53 1.375 0 2.682.895 4.074.895 1.322 0 3.087-.957 5.068-.957.822 0 3.783.069 5.734 3.097-6.047 3.086-6.097 13.62.115 13.962z" />
    </svg>
  );
}

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
  return {
    ...u,
    first_name,
    last_name,
    firstName: u.firstName ?? first_name,
    lastName: u.lastName ?? last_name,
    name,
    legalTermsAcceptedAt: legalTs,
    legal_terms_accepted_at: legalTs,
  };
}

/** Persisted referral for landing `?ref=` + OAuth/email continuation (Stage 72.6). */
const PENDING_REF_COOKIE = 'gostaylo_pending_ref';
const PENDING_REF_LS = 'gostaylo_pending_ref_code';

function readPendingRefFromCookie() {
  if (typeof document === 'undefined') return '';
  try {
    const row = document.cookie.split(';').map((s) => s.trim());
    const hit = row.find((c) => c.startsWith(`${PENDING_REF_COOKIE}=`));
    if (!hit) return '';
    const raw = decodeURIComponent(hit.slice(PENDING_REF_COOKIE.length + 1));
    return String(raw || '').trim();
  } catch {
    return '';
  }
}

function persistPendingReferralCode(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code || typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_REF_LS, code);
    const secure = window.location.protocol === 'https:';
    document.cookie = `${PENDING_REF_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 120}; SameSite=Lax${secure ? '; Secure' : ''}`;
  } catch {
    /* ignore */
  }
}

function getStableReferralFingerprint() {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem('gostaylo_ref_fingerprint');
    if (existing) return existing;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'na';
    const raw = [
      navigator.userAgent || 'ua',
      navigator.language || 'lang',
      navigator.platform || 'platform',
      String(window.screen?.width || 0),
      String(window.screen?.height || 0),
      tz,
    ].join('|');
    const fp = btoa(unescape(encodeURIComponent(raw))).slice(0, 160);
    localStorage.setItem('gostaylo_ref_fingerprint', fp);
    return fp;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language: uiLanguage } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  
  // Form state
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verification_pending' | 'forgot_password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState('idle'); // idle | checking | valid | invalid
  const [promoMessage, setPromoMessage] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [registerLegalConsent, setRegisterLegalConsent] = useState(false);
  const [oauthProviderBusy, setOauthProviderBusy] = useState(null);

  const persistOAuthLegalCookie = useCallback((accept) => {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:';
    if (accept) {
      document.cookie = `gostaylo_oauth_legal=1; Path=/; Max-Age=600; SameSite=Lax${secure ? '; Secure' : ''}`;
    } else {
      document.cookie = `gostaylo_oauth_legal=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`;
    }
  }, []);

  const startOAuth = useCallback(
    async (provider) => {
      if (authMode === 'register' && !registerLegalConsent) {
        setError(getUIText('auth_registerLegalRequired', uiLanguage));
        return;
      }
      persistOAuthLegalCookie(authMode === 'register');
      const sb = getOAuthBrowserSupabase();
      if (!sb) {
        toast.error(getUIText('auth_oauthUnavailable', uiLanguage));
        return;
      }
      setOauthProviderBusy(provider);
      setError('');
      try {
        let nextPath = pathname || '/profile/';
        try {
          const saved = sessionStorage.getItem('gostaylo_redirect_after_login');
          if (saved?.startsWith('/')) nextPath = saved;
        } catch {
          /* ignore */
        }
        if (!nextPath.startsWith('/') || nextPath.startsWith('//')) nextPath = '/profile/';
        const withSlash = nextPath.endsWith('/') ? nextPath : `${nextPath}/`;

        const callback = new URL(`${window.location.origin}/auth/callback/`);
        callback.searchParams.set('next', withSlash);

        const options = { redirectTo: callback.toString() };
        if (provider === 'google') {
          options.queryParams = { access_type: 'offline', prompt: 'select_account' };
        }
        const { data, error } = await sb.auth.signInWithOAuth({ provider, options });
        if (error) throw error;
        if (data?.url) {
          window.location.assign(data.url);
        }
      } catch (e) {
        console.error('[oauth]', e);
        toast.error(e?.message || 'OAuth failed');
        persistOAuthLegalCookie(false);
      } finally {
        setOauthProviderBusy(null);
      }
    },
    [authMode, pathname, persistOAuthLegalCookie, registerLegalConsent, uiLanguage],
  );

  // Load user on mount (from cookie session)
  useEffect(() => {
    const loadUser = async () => {
      // First check localStorage for quick UI
      const stored = localStorage.getItem('gostaylo_user');
      if (stored) {
        try {
          setUser(normalizeAuthUser(JSON.parse(stored)));
        } catch (e) {}
      }
      
      // Then verify with server
      const serverUser = await getCurrentUser();
      if (serverUser) {
        const normalized = normalizeAuthUser(serverUser);
        setUser(normalized);
        localStorage.setItem('gostaylo_user', JSON.stringify(normalized));
      } else if (stored) {
        // Session expired, clear localStorage
        localStorage.removeItem('gostaylo_user');
        setUser(null);
      }
      
      setLoading(false);
    };
    
    loadUser();
    
    // Listen for storage changes
    const handleStorage = (e) => {
      if (e.key === 'gostaylo_user') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /** Capture `?ref=` on load and sync cookie/localStorage so OAuth/email flows cannot drop the referrer. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('ref')?.trim();
      const fromCookie = readPendingRefFromCookie();
      const fromLs = localStorage.getItem(PENDING_REF_LS)?.trim();
      const picked = fromUrl || fromCookie || fromLs || '';
      if (!picked) return;
      persistPendingReferralCode(picked);
      setPromoCode(String(picked).trim().toUpperCase());
      setPromoStatus('checking');
      setPromoMessage('');
      void fetch('/api/v2/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: String(picked).trim().toUpperCase(),
          email: '',
          fingerprint: getStableReferralFingerprint(),
        }),
      })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.valid) {
            setPromoStatus('valid');
            setPromoMessage('Реферальный код сохранён');
          } else {
            setPromoStatus('invalid');
            setPromoMessage(json?.error || 'Реферальный код недействителен');
          }
        })
        .catch(() => {
          setPromoStatus('invalid');
          setPromoMessage('Не удалось проверить реферальный код');
        });
    } catch {
      /* ignore */
    }
  }, []);

  const refreshUserFromServer = useCallback(async () => {
    try {
      const serverUser = await getCurrentUser();
      if (serverUser) {
        const normalized = normalizeAuthUser(serverUser);
        setUser(normalized);
        localStorage.setItem('gostaylo_user', JSON.stringify(normalized));
        window.dispatchEvent(new CustomEvent('auth-change', { detail: normalized }));
        return normalized;
      }
      localStorage.removeItem('gostaylo_user');
      setUser(null);
      window.dispatchEvent(new CustomEvent('auth-change', { detail: null }));
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const onSessionRefresh = () => {
      refreshUserFromServer();
    };
    window.addEventListener('gostaylo-refresh-session', onSessionRefresh);
    window.addEventListener('gostaylo-switch-role', onSessionRefresh);
    return () => {
      window.removeEventListener('gostaylo-refresh-session', onSessionRefresh);
      window.removeEventListener('gostaylo-switch-role', onSessionRefresh);
    };
  }, [refreshUserFromServer]);

  const openLoginModal = useCallback((mode) => {
    persistOAuthLegalCookie(false);
    // Handle case when called from onClick (event passed as first arg)
    const actualMode = (typeof mode === 'string') ? mode : 'login';
    setAuthMode(actualMode);
    setEmail('');
    setPassword('');
    setName('');
    try {
      const persisted =
        readPendingRefFromCookie() ||
        (typeof window !== 'undefined' ? localStorage.getItem(PENDING_REF_LS)?.trim() : '');
      if (persisted) {
        setPromoCode(String(persisted).trim().toUpperCase());
      } else {
        setPromoCode('');
      }
      setPromoStatus('idle');
      setPromoMessage('');
    } catch {
      setPromoCode('');
      setPromoStatus('idle');
      setPromoMessage('');
    }
    setError('');
    setRegisterLegalConsent(false);
    setLoginModalOpen(true);
  }, [persistOAuthLegalCookie]);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    setError('');
    setAuthMode('login');
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Check if there's a saved redirect URL from Access Denied page
      const savedRedirect = sessionStorage.getItem('gostaylo_redirect_after_login');
      
      // If user is already on a protected page (like /partner/listings), 
      // stay there after login instead of redirecting to role-based default
      const currentPath = window.location.pathname;
      const stayOnCurrentPage = currentPath.startsWith('/partner/') || 
                                currentPath.startsWith('/admin/') ||
                                currentPath.startsWith('/renter/');
      
      const customRedirect = savedRedirect || (stayOnCurrentPage ? currentPath : null);
      
      const result = await signIn(email.toLowerCase().trim(), password, customRedirect);
      
      if (result.requiresVerification) {
        setVerificationEmail(result.email || email);
        setAuthMode('verification_pending');
        setSubmitting(false);
        return;
      }
      
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      const normalizedLogin = normalizeAuthUser(result.user);
      setUser(normalizedLogin);
      localStorage.setItem('gostaylo_user', JSON.stringify(normalizedLogin));
      closeLoginModal();
      
      // Clear saved redirect URL after successful login
      if (savedRedirect) {
        sessionStorage.removeItem('gostaylo_redirect_after_login');
      }
      
      window.dispatchEvent(new CustomEvent('auth-change', { detail: normalizedLogin }));
      
      // Redirect priority: savedRedirect > stayOnCurrentPage > result.redirectTo
      if (savedRedirect) {
        router.push(savedRedirect);
      } else if (stayOnCurrentPage) {
        router.refresh();
      } else if (result.redirectTo) {
        router.push(result.redirectTo);
      }
      
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Register handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const typedRef = String(promoCode || '').trim().toUpperCase();
      let fallbackRef = '';
      try {
        fallbackRef =
          readPendingRefFromCookie().trim().toUpperCase() ||
          String(localStorage.getItem(PENDING_REF_LS) || '').trim().toUpperCase();
      } catch {
        fallbackRef = '';
      }
      const effectiveRef = typedRef || fallbackRef || '';

      let referredByPayload = null;
      if (effectiveRef) {
        try {
          const vr = await fetch('/api/v2/referral/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: effectiveRef,
              email: email.toLowerCase().trim(),
              fingerprint: getStableReferralFingerprint(),
            }),
          });
          const vjson = await vr.json().catch(() => ({}));
          if (!vr.ok || !vjson?.valid) {
            setError(vjson?.error || 'Проверьте корректность реферального кода перед регистрацией');
            setSubmitting(false);
            return;
          }
          referredByPayload = effectiveRef;
          setPromoStatus('valid');
          setPromoMessage('Промокод принят');
          setPromoCode(effectiveRef);
        } catch {
          setError('Не удалось проверить реферальный код');
          setSubmitting(false);
          return;
        }
      }

      if (!registerLegalConsent) {
        setError(getUIText('auth_registerLegalRequired', uiLanguage));
        setSubmitting(false);
        return;
      }

      const result = await signUp({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
        role: 'RENTER',
        referredBy: referredByPayload,
        referralFingerprint: getStableReferralFingerprint(),
        acceptedLegalTerms: true,
      });
      
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      try {
        document.cookie = `${PENDING_REF_COOKIE}=; Path=/; Max-Age=0`;
        localStorage.removeItem(PENDING_REF_LS);
      } catch {
        /* ignore */
      }

      // Show verification pending screen
      setVerificationEmail(email);
      setAuthMode('verification_pending');
      
      if (result.emailError) {
        toast.error(`Ошибка отправки email: ${result.emailError}`);
      } else if (result.requiresVerification && result.emailSent === false) {
        toast.warning(
          'Аккаунт создан, но письмо не отправлено. Проверьте настройки почты на сервере или нажмите «Отправить снова».',
        );
      }
      
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const validatePromoCode = useCallback(async () => {
    const code = String(promoCode || '').trim().toUpperCase();
    if (!code) {
      setPromoStatus('idle');
      setPromoMessage('');
      return false;
    }
    setPromoStatus('checking');
    setPromoMessage('');
    try {
      const res = await fetch('/api/v2/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email: email.toLowerCase().trim(),
          fingerprint: getStableReferralFingerprint(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.valid) {
        setPromoCode(code);
        setPromoStatus('valid');
        setPromoMessage('Промокод принят');
        return true;
      }
      setPromoStatus('invalid');
      setPromoMessage(json?.error || 'Промокод недействителен');
      return false;
    } catch {
      setPromoStatus('invalid');
      setPromoMessage('Не удалось проверить промокод');
      return false;
    }
  }, [promoCode, email]);

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/v2/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setForgotPasswordSent(true);
        toast.success('Письмо отправлено! Проверьте почту.');
      } else {
        setError(result.error || 'Не удалось отправить письмо');
      }
    } catch (err) {
      setError('Ошибка сервера');
    } finally {
      setSubmitting(false);
    }
  };

  // Logout handler
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: null }));
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
    openLoginModal,
    closeLoginModal,
    logout,
    updateUser,
    refreshUserFromServer,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className='sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto flex flex-col'>
          {authMode === 'verification_pending' ? (
            // Verification Pending Screen
            <>
              <DialogHeader>
                <DialogTitle className='flex items-center gap-2'>
                  <Mail className='h-5 w-5 text-teal-600' />
                  Подтвердите email
                </DialogTitle>
              </DialogHeader>
              <div className='py-6 text-center space-y-4'>
                <div className='w-16 h-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center'>
                  <Mail className='h-8 w-8 text-teal-600' />
                </div>
                <p className='text-slate-600'>
                  Мы отправили письмо на<br />
                  <strong className='text-slate-900'>{verificationEmail}</strong>
                </p>
                <p className='text-sm text-slate-500'>
                  Перейдите по ссылке в письме для активации аккаунта.
                  Проверьте папку "Спам" если письмо не пришло.
                </p>
                <Button
                  variant='outline'
                  onClick={() => setAuthMode('login')}
                  className='mt-4'
                >
                  Вернуться ко входу
                </Button>
              </div>
            </>
          ) : authMode === 'forgot_password' ? (
            // Forgot Password Screen
            <>
              <DialogHeader>
                <DialogTitle>Восстановление пароля</DialogTitle>
                <DialogDescription>
                  Введите email для получения ссылки на сброс пароля
                </DialogDescription>
              </DialogHeader>
              
              {forgotPasswordSent ? (
                <div className='py-6 text-center space-y-4'>
                  <div className='w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center'>
                    <CheckCircle className='h-8 w-8 text-green-600' />
                  </div>
                  <p className='text-slate-600'>
                    Письмо отправлено на<br />
                    <strong className='text-slate-900'>{email}</strong>
                  </p>
                  <p className='text-sm text-slate-500'>
                    Проверьте почту и перейдите по ссылке для сброса пароля
                  </p>
                  <Button
                    variant='outline'
                    onClick={() => { setAuthMode('login'); setForgotPasswordSent(false); }}
                  >
                    Вернуться ко входу
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className='space-y-4 pb-6 sm:pb-0'>
                  <div className='space-y-2'>
                    <Label htmlFor='forgot-email'>Email</Label>
                    <Input 
                      id='forgot-email' 
                      type='email' 
                      placeholder='your@email.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                      autoFocus
                      inputMode='email'
                      autoComplete='username'
                      required
                    />
                  </div>
                  
                  {error && (
                    <p className='text-red-500 text-sm'>{error}</p>
                  )}
                  
                  <Button 
                    type='submit' 
                    className='w-full bg-teal-600 hover:bg-teal-700'
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Отправка...
                      </>
                    ) : (
                      'Отправить ссылку'
                    )}
                  </Button>
                  
                  <button
                    type='button'
                    onClick={() => setAuthMode('login')}
                    className='w-full text-sm text-slate-500 hover:text-slate-700'
                  >
                    Вернуться ко входу
                  </button>
                </form>
              )}
            </>
          ) : (
            // Login / Register Form
            <>
              <DialogHeader className='pb-2 flex-shrink-0'>
                <DialogTitle className='text-lg'>
                  {authMode === 'login' ? 'Вход в систему' : 'Регистрация'}
                </DialogTitle>
                <DialogDescription className='text-sm'>
                  {authMode === 'login'
                    ? `Войдите в свой аккаунт ${getSiteDisplayName()}`
                    : 'Создайте новый аккаунт'}
                </DialogDescription>
              </DialogHeader>
              
              <div className='flex border-b mb-3 flex-shrink-0'>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('login');
                    setRegisterLegalConsent(false);
                    setError('');
                    // Focus email field after mode switch
                    setTimeout(() => document.getElementById('auth-email')?.focus(), 100);
                  }}
                  className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    authMode === 'login' 
                      ? 'border-teal-600 text-teal-600 bg-teal-50/50' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Вход
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('register');
                    setRegisterLegalConsent(false);
                    setError('');
                    // Focus name field after mode switch
                    setTimeout(() => document.getElementById('auth-name')?.focus(), 100);
                  }}
                  className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    authMode === 'register' 
                      ? 'border-teal-600 text-teal-600 bg-teal-50/50' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Регистрация
                </button>
              </div>

              {authMode === 'register' ? (
                <div className='flex-shrink-0 pb-3'>
                  <LegalConsentCheckboxRow
                    language={uiLanguage}
                    checked={registerLegalConsent}
                    onCheckedChange={setRegisterLegalConsent}
                    id='auth-register-legal-consent-oauth'
                    className='rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5'
                  />
                </div>
              ) : null}

              <div className='flex-shrink-0 space-y-2 pb-2'>
                <div className='relative flex items-center justify-center py-2'>
                  <span className='absolute inset-x-0 top-1/2 h-px bg-slate-100' aria-hidden />
                  <span className='relative bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400'>
                    {getUIText('auth_oauthDivider', uiLanguage)}
                  </span>
                </div>
                <div className='grid grid-cols-1 gap-2'>
                  <button
                    type='button'
                    onClick={() => void startOAuth('google')}
                    disabled={
                      oauthProviderBusy !== null ||
                      submitting ||
                      (authMode === 'register' && !registerLegalConsent)
                    }
                    className='flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-teal-400/60 hover:bg-slate-50/80 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45'
                  >
                    {oauthProviderBusy === 'google' ? (
                      <Loader2 className='h-4 w-4 animate-spin text-slate-600' />
                    ) : (
                      <GoogleBrandGlyph />
                    )}
                    {getUIText('auth_continueGoogle', uiLanguage)}
                  </button>
                  <button
                    type='button'
                    onClick={() => void startOAuth('apple')}
                    disabled={
                      oauthProviderBusy !== null ||
                      submitting ||
                      (authMode === 'register' && !registerLegalConsent)
                    }
                    className='flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45'
                  >
                    {oauthProviderBusy === 'apple' ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <AppleBrandGlyph />
                    )}
                    {getUIText('auth_continueApple', uiLanguage)}
                  </button>
                </div>
              </div>

              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className='flex flex-col flex-1 min-h-0 overflow-hidden'>
                <div className='space-y-3 flex-1 overflow-y-auto pb-2'>
                  {authMode === 'register' && (
                    <div className='space-y-1.5'>
                      <Label htmlFor='auth-name' className='text-sm'>Имя</Label>
                      <Input 
                        id='auth-name' 
                        type='text' 
                        placeholder='Ваше имя'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                        autoComplete='name'
                        className='h-11 text-base'
                        required
                      />
                    </div>
                  )}

                  {authMode === 'register' && (
                    <div className='space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <Label htmlFor='auth-referral-code' className='text-sm'>
                          У меня есть промокод
                        </Label>
                        <button
                          type='button'
                          className='text-xs text-teal-600 hover:text-teal-700 hover:underline'
                          onClick={() => void validatePromoCode()}
                          disabled={!promoCode || promoStatus === 'checking'}
                        >
                          Проверить
                        </button>
                      </div>
                      <Input
                        id='auth-referral-code'
                        type='text'
                        placeholder='AIR-ID123'
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(String(e.target.value || '').toUpperCase());
                          setPromoStatus('idle');
                          setPromoMessage('');
                        }}
                        onBlur={() => void validatePromoCode()}
                        autoComplete='off'
                        className='h-11 text-base uppercase'
                      />
                      {promoMessage ? (
                        <p
                          className={`text-xs ${
                            promoStatus === 'valid'
                              ? 'text-emerald-600'
                              : promoStatus === 'checking'
                                ? 'text-slate-500'
                                : 'text-red-500'
                          }`}
                        >
                          {promoMessage}
                        </p>
                      ) : null}
                    </div>
                  )}
                  
                  <div className='space-y-1.5'>
                    <Label htmlFor='auth-email' className='text-sm'>Email</Label>
                    <Input 
                      id='auth-email' 
                      type='email' 
                      placeholder='your@email.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                      autoFocus
                      inputMode='email'
                      autoComplete='username'
                      className='h-11 text-base'
                      enterKeyHint='next'
                      required
                    />
                  </div>
                  
                  <div className='space-y-1.5'>
                    <div className='flex justify-between items-center'>
                      <Label htmlFor='auth-password' className='text-sm'>Пароль</Label>
                      {authMode === 'login' && (
                        <button
                          type='button'
                          onClick={() => { setAuthMode('forgot_password'); setError(''); setForgotPasswordSent(false); }}
                          className='text-xs text-teal-600 hover:text-teal-700 hover:underline'
                        >
                          Забыли пароль?
                        </button>
                      )}
                    </div>
                    <div className='relative'>
                      <Input 
                        id='auth-password' 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder='••••••••'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                        className='pr-10 h-11 text-base'
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        enterKeyHint='done'
                        required
                        minLength={authMode === 'register' ? 6 : undefined}
                      />
                      <button
                        type='button'
                        onClick={() => setShowPassword(!showPassword)}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                      >
                        {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                      </button>
                    </div>
                    {authMode === 'register' && (
                      <p className='text-xs text-slate-500'>Минимум 6 символов</p>
                    )}
                  </div>
                  
                  {error && (
                    <p className='text-red-500 text-sm'>{error}</p>
                  )}

                </div>
                
                {/* Fixed button at bottom - always visible */}
                <div className='flex-shrink-0 pt-3 border-t border-slate-100 mt-2'>
                  <Button 
                    type='submit' 
                    className='w-full bg-teal-600 hover:bg-teal-700 h-12 text-base font-medium'
                    disabled={
                      submitting ||
                      (authMode === 'register' && !registerLegalConsent)
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Загрузка...
                      </>
                    ) : (
                      authMode === 'login' ? 'Войти' : 'Создать аккаунт'
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
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
