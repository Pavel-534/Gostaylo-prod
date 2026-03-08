/**
 * Gostaylo - Global Auth Context
 * Provides authentication state across the entire app
 * Allows opening login modal from anywhere without page redirects
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '@/lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  
  // Form state
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load user on mount
  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
    setLoading(false);

    // Listen for storage changes (logout from another tab)
    const handleStorage = (e) => {
      if (e.key === 'gostaylo_user') {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {}
        } else {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Open login modal
  const openLoginModal = useCallback(() => {
    setAuthMode('login');
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setLoginModalOpen(true);
  }, []);

  // Close login modal
  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    setError('');
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await signIn(email.toLowerCase(), password);
      
      if (result.error) {
        setError(result.error);
        return;
      }

      setUser(result.user);
      localStorage.setItem('gostaylo_user', JSON.stringify(result.user));
      closeLoginModal();
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('auth-change', { detail: result.user }));
      
      // RBAC: Redirect based on API response
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
        email: email.toLowerCase(),
        password,
        name,
        role: 'RENTER'
      });
      
      if (result.error) {
        setError(result.error);
        return;
      }

      setUser(result.user);
      localStorage.setItem('gostaylo_user', JSON.stringify(result.user));
      closeLoginModal();
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('auth-change', { detail: result.user }));
      
      // Redirect to home for new users
      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
      
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem('gostaylo_user');
    localStorage.removeItem('gostaylo_auth_token');
    setUser(null);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: null }));
    router.push('/');
  }, [router]);

  // Update user (after profile changes)
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
      
      {/* Global Login Modal */}
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className='sm:max-w-md'>
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
          
          {/* Auth Tabs */}
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
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='auth-password'>Пароль</Label>
              <div className='relative'>
                <Input 
                  id='auth-password' 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder='••••••••'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='pr-10'
                  required
                  minLength={authMode === 'register' ? 8 : undefined}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                >
                  {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
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
