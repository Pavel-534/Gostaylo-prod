'use client'

import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { getUIText } from '@/lib/translations'

export function LoginForm({
  language,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  submitting,
  error,
  onSubmit,
  onForgotPassword,
}) {
  return (
    <form onSubmit={onSubmit} className='flex min-h-0 flex-col overflow-hidden'>
      <div className='max-h-[min(52vh,400px)] space-y-3 overflow-y-auto pb-2'>
        <div className='space-y-1.5'>
          <Label htmlFor='auth-email' className='text-sm'>
            {getUIText('email', language)}
          </Label>
          <Input
            id='auth-email'
            type='email'
            placeholder={getUIText('auth_email_placeholder', language)}
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            onFocus={(e) =>
              setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
            }
            autoFocus
            inputMode='email'
            autoComplete='username'
            className='h-11 text-base'
            enterKeyHint='next'
            required
          />
        </div>

        <div className='space-y-1.5'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='auth-password' className='text-sm'>
              {getUIText('password', language)}
            </Label>
            <button
              type='button'
              onClick={onForgotPassword}
              className='text-xs text-teal-600 hover:text-teal-700 hover:underline'
            >
              {getUIText('auth_forgot_password', language)}
            </button>
          </div>
          <div className='relative'>
            <Input
              id='auth-password'
              type={showPassword ? 'text' : 'password'}
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) =>
                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
              }
              className='h-11 pr-10 text-base'
              autoComplete='current-password'
              enterKeyHint='done'
              required
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

        {error ? <p className='text-sm text-red-500'>{error}</p> : null}
      </div>

      <div className='mt-2 flex-shrink-0 border-t border-slate-100 pt-3'>
        <Button type='submit' className='h-12 w-full bg-teal-600 text-base font-medium hover:bg-teal-700' disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {getUIText('loading', language)}
            </>
          ) : (
            getUIText('loginButton', language)
          )}
        </Button>
      </div>
    </form>
  )
}

export default LoginForm
