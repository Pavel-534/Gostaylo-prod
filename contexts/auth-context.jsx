/**
 * Gostaylo - Global Auth Context
 * Сессия: HttpOnly-кука `gostaylo_session` выставляется только сервером (login/verify);
 * SameSite=Lax и Secure (на production) задаются в API — домен не фиксируется, работает .ru / .com.
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';
import { signIn, signUp, getCurrentUser, signOut } from '@/lib/auth';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
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
  const [verificationEmail, setVerificationEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Load user on mount (from cookie session)
  useEffect(() => {
    const loadUser = async () => {
      // First check localStorage for quick UI
      const stored = localStorage.getItem('gostaylo_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {}
      }
      
      // Then verify with server
      const serverUser = await getCurrentUser();
      if (serverUser) {
        setUser(serverUser);
        localStorage.setItem('gostaylo_user', JSON.stringify(serverUser));
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

  const openLoginModal = useCallback((mode) => {
    // Handle case when called from onClick (event passed as first arg)
    const actualMode = (typeof mode === 'string') ? mode : 'login';
    setAuthMode(actualMode);
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setLoginModalOpen(true);
  }, []);

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

      setUser(result.user);
      closeLoginModal();
      
      // Clear saved redirect URL after successful login
      if (savedRedirect) {
        sessionStorage.removeItem('gostaylo_redirect_after_login');
      }
      
      window.dispatchEvent(new CustomEvent('auth-change', { detail: result.user }));
      
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
      const result = await signUp({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
        role: 'RENTER'
      });
      
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      // Show verification pending screen
      setVerificationEmail(email);
      setAuthMode('verification_pending');
      
      if (result.emailError) {
        toast.error(`Ошибка отправки email: ${result.emailError}`);
      }
      
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

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
    setUser(updatedUser);
    localStorage.setItem('gostaylo_user', JSON.stringify(updatedUser));
    window.dispatchEvent(new CustomEvent('auth-change', { detail: updatedUser }));
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
                    ? 'Войдите в свой аккаунт Gostaylo'
                    : 'Создайте новый аккаунт'}
                </DialogDescription>
              </DialogHeader>
              
              <div className='flex border-b mb-3 flex-shrink-0'>
                <button
                  type='button'
                  onClick={() => { 
                    setAuthMode('login'); 
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
                    disabled={submitting}
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
