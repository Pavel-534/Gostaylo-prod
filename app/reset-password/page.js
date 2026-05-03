'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/contexts/i18n-context';
import { getUIText, getAuthErrorMessage } from '@/lib/translations';
import { isAuthPasswordCompliant, AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

function ResetPasswordContent() {
  const router = useRouter();
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError(getAuthErrorMessage('AUTH_RESET_PAGE_NO_TOKEN', language));
    }
  }, [token, language]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(getAuthErrorMessage('AUTH_RESET_PASSWORD_MISMATCH', language));
      return;
    }

    if (!isAuthPasswordCompliant(password)) {
      if (!password || password.length < AUTH_PASSWORD_MIN_LENGTH) {
        setError(getAuthErrorMessage('AUTH_PASSWORD_TOO_SHORT_RESET', language));
      } else {
        setError(getAuthErrorMessage('AUTH_PASSWORD_REQUIREMENTS', language));
      }
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v2/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json().catch(() => ({}));

      if (result.success) {
        setSuccess(true);
        toast.success(getUIText('AUTH_PASSWORD_CHANGED_TOAST', language));
        setTimeout(() => router.push('/'), 2000);
      } else {
        setError(getAuthErrorMessage(result.error_code, language));
      }
    } catch (err) {
      setError(getAuthErrorMessage('AUTH_INTERNAL', language));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50 p-4'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6 text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100'>
              <CheckCircle className='h-8 w-8 text-green-600' />
            </div>
            <h2 className='mb-2 text-xl font-semibold text-slate-900'>
              {getUIText('AUTH_PASSWORD_CHANGED_TITLE', language)}
            </h2>
            <p className='mb-4 text-slate-600'>{getUIText('AUTH_PASSWORD_CHANGED_LEAD', language)}</p>
            <Button onClick={() => router.push('/')} className='bg-teal-600 hover:bg-teal-700'>
              {getUIText('AUTH_GO_HOME', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50 p-4'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6 text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
              <XCircle className='h-8 w-8 text-red-600' />
            </div>
            <h2 className='mb-2 text-xl font-semibold text-slate-900'>
              {getUIText('AUTH_RESET_INVALID_TITLE', language)}
            </h2>
            <p className='mb-4 text-slate-600'>{getUIText('AUTH_RESET_INVALID_LEAD', language)}</p>
            <Button onClick={() => router.push('/')} variant='outline'>
              {getUIText('AUTH_GO_HOME', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50 p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>{getUIText('AUTH_RESET_TITLE', language)}</CardTitle>
          <CardDescription>{getUIText('AUTH_RESET_DESC', language)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='password'>{getUIText('AUTH_RESET_NEW_PASSWORD_LABEL', language)}</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='••••••••'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='pr-10'
                  autoFocus
                  autoComplete='new-password'
                  required
                  minLength={8}
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

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>{getUIText('AUTH_RESET_CONFIRM_LABEL', language)}</Label>
              <Input
                id='confirmPassword'
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete='new-password'
                required
                minLength={8}
              />
            </div>

            {error ? <p className='text-sm text-red-500'>{error}</p> : null}

            <Button type='submit' className='w-full bg-teal-600 hover:bg-teal-700' disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {getUIText('AUTH_RESET_SAVING', language)}
                </>
              ) : (
                getUIText('AUTH_RESET_SAVE_CTA', language)
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center bg-slate-50'>
          <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
