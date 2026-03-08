/**
 * Gostaylo - Global Auth Context
 * Provides authentication state and login modal
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
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verification_pending'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

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

  const openLoginModal = useCallback((mode = 'login') => {
    setAuthMode(mode);
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
      const result = await signIn(email.toLowerCase().trim(), password);
      
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
      
      window.dispatchEvent(new CustomEvent('auth-change', { detail: result.user }));
      
      if (result.redirectTo) {
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
    isPartner: user?.role === 'PARTNER',
    isRenter: user?.role === 'RENTER' || !user?.role,
    openLoginModal,
    closeLoginModal,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className='sm:max-w-md'>
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
          ) : (
            // Login / Register Form
            <>
              <DialogHeader>
                <DialogTitle>
                  {authMode === 'login' ? 'Вход в систему' : 'Регистрация'}
                </DialogTitle>
                <DialogDescription>
                  {authMode === 'login' 
                    ? 'Войдите в свой аккаунт Gostaylo'
                    : 'Создайте новый аккаунт'}
                </DialogDescription>
              </DialogHeader>
              
              <div className='flex border-b mb-4'>
                <button
                  type='button'
                  onClick={() => { setAuthMode('login'); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    authMode === 'login' 
                      ? 'border-teal-600 text-teal-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Вход
                </button>
                <button
                  type='button'
                  onClick={() => { setAuthMode('register'); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    authMode === 'register' 
                      ? 'border-teal-600 text-teal-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Регистрация
                </button>
              </div>
              
              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className='space-y-4'>
                {authMode === 'register' && (
                  <div className='space-y-2'>
                    <Label htmlFor='auth-name'>Имя</Label>
                    <Input 
                      id='auth-name' 
                      type='text' 
                      placeholder='Ваше имя'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete='name'
                      required
                    />
                  </div>
                )}
                
                <div className='space-y-2'>
                  <Label htmlFor='auth-email'>Email</Label>
                  <Input 
                    id='auth-email' 
                    type='email' 
                    placeholder='your@email.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    autoFocus
                    inputMode='email'
                    autoComplete='username'
                    required
                  />
                </div>
                
                <div className='space-y-2'>
                  <div className='flex justify-between items-center'>
                    <Label htmlFor='auth-password'>Пароль</Label>
                    {authMode === 'login' && (
                      <button
                        type='button'
                        onClick={() => toast.info('Функция восстановления пароля скоро будет доступна')}
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
                      className='pr-10'
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
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
                
                <Button 
                  type='submit' 
                  className='w-full bg-teal-600 hover:bg-teal-700'
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
