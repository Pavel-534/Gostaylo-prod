'use client'

import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { LegalConsentCheckboxRow } from '@/components/legal/LegalConsentCheckboxRow'
import { isAuthPasswordCompliant, AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'

export function RegisterForm({
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
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className='flex min-h-0 flex-col overflow-hidden'>
      <div className='max-h-[min(52vh,400px)] space-y-3 overflow-y-auto pb-2'>
        <div className='space-y-1.5'>
          <Label htmlFor='auth-name' className='text-sm'>
            {getUIText('auth_field_firstName', language)}
          </Label>
          <Input
            id='auth-name'
            type='text'
            placeholder={getUIText('auth_field_firstNamePlaceholder', language)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) =>
              setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
            }
            autoComplete='name'
            className='h-11 text-base'
            required
          />
        </div>

        <div className='space-y-1.5'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='auth-referral-code' className='text-sm'>
              {getUIText('auth_referral_label', language)}
            </Label>
            <button
              type='button'
              className='text-xs text-brand hover:text-brand-hover hover:underline'
              onClick={() => void validatePromoCode()}
              disabled={!promoCode || promoStatus === 'checking'}
            >
              {getUIText('auth_referral_check', language)}
            </button>
          </div>
          <Input
            id='auth-referral-code'
            type='text'
            placeholder={getUIText('auth_referral_placeholder', language)}
            value={promoCode}
            onChange={(e) => {
              setPromoCode(String(e.target.value || '').toUpperCase())
              setPromoStatus('idle')
              setPromoMessage('')
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
            inputMode='email'
            autoComplete='username'
            className='h-11 text-base'
            enterKeyHint='next'
            required
          />
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='auth-password' className='text-sm'>
            {getUIText('password', language)}
          </Label>
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
              autoComplete='new-password'
              enterKeyHint='done'
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
          <p className='text-xs text-slate-500'>{getUIText('auth_password_minHint', language)}</p>
          {password.length > 0 && !isAuthPasswordCompliant(password) ? (
            <p className='text-xs text-red-500'>
              {password.length < AUTH_PASSWORD_MIN_LENGTH
                ? getAuthErrorMessage('AUTH_PASSWORD_TOO_SHORT', language)
                : getAuthErrorMessage('AUTH_PASSWORD_REQUIREMENTS', language)}
            </p>
          ) : null}
        </div>

        <div className='rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5'>
          <LegalConsentCheckboxRow
            language={language}
            checked={registerLegalConsent}
            onCheckedChange={setRegisterLegalConsent}
            id='auth-register-legal-consent-oauth'
            className='border-0 bg-transparent p-0'
          />
        </div>

        {error ? <p className='text-sm text-red-500'>{error}</p> : null}
      </div>

      <div className='mt-2 flex-shrink-0 border-t border-slate-100 pt-3'>
        <Button
          type='submit'
          variant='brand'
          className='h-12 w-full text-base font-medium'
          disabled={submitting || !registerLegalConsent || !isAuthPasswordCompliant(password)}
        >
          {submitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {getUIText('loading', language)}
            </>
          ) : (
            getUIText('auth_modal_submitCreate', language)
          )}
        </Button>
      </div>
    </form>
  )
}

export default RegisterForm
