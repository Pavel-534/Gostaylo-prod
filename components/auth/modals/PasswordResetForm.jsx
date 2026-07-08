'use client'

import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getUIText } from '@/lib/translations'

export function PasswordResetForm({
  language,
  email,
  setEmail,
  error,
  submitting,
  forgotPasswordSent,
  setForgotPasswordSent,
  setAuthMode,
  onSubmit,
}) {
  if (forgotPasswordSent) {
    return (
      <div className='py-6 text-center space-y-4'>
        <div className='w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center'>
          <CheckCircle className='h-8 w-8 text-green-600' />
        </div>
        <p className='text-slate-600'>
          {getUIText('auth_forgot_sentLead', language)}
          <br />
          <strong className='text-slate-900'>{email}</strong>
        </p>
        <p className='text-sm text-slate-500'>{getUIText('auth_forgot_sentInstructions', language)}</p>
        <Button
          variant='outline'
          className='h-11 px-5'
          onClick={() => {
            setAuthMode('login')
            setForgotPasswordSent(false)
          }}
        >
          {getUIText('auth_backToLogin', language)}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className='space-y-4 pb-6 sm:pb-0'>
      <div className='space-y-2'>
        <Label htmlFor='forgot-email'>{getUIText('email', language)}</Label>
        <Input
          id='forgot-email'
          type='email'
          placeholder={getUIText('auth_email_placeholder', language)}
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
          autoFocus
          inputMode='email'
          autoComplete='email'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
          className='h-11 text-base'
          enterKeyHint='done'
          required
        />
      </div>

      {error && <p className='text-red-500 text-sm'>{error}</p>}

      <Button type='submit' variant='brand' className='h-12 w-full text-base font-medium' disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
            {getUIText('auth_forgot_sending', language)}
          </>
        ) : (
          getUIText('auth_forgot_sendLink', language)
        )}
      </Button>

      <button
        type='button'
        onClick={() => setAuthMode('login')}
        className='w-full min-h-11 py-3 text-sm text-slate-500 hover:text-slate-700'
      >
        {getUIText('auth_backToLogin', language)}
      </button>
    </form>
  )
}

export default PasswordResetForm
