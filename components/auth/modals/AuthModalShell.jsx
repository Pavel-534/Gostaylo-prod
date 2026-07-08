'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { LoginForm } from '@/components/auth/modals/LoginForm'
import { RegisterForm } from '@/components/auth/modals/RegisterForm'
import { PasswordResetForm } from '@/components/auth/modals/PasswordResetForm'
import { useGeo } from '@/contexts/geo-context'
import { useIsMobile } from '@/hooks/use-mobile'

function GoogleBrandGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox='0 0 24 24' aria-hidden='true'>
      <path
        fill='#4285F4'
        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
      />
      <path
        fill='#34A853'
        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
      />
      <path
        fill='#FBBC05'
        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
      />
      <path
        fill='#EA4335'
        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
      />
    </svg>
  )
}

export function AuthModalShell(props) {
  const {
    language,
    loginModalOpen,
    onLoginModalOpenChange,
    authMode,
    setAuthMode,
    verificationEmail,
    forgotPasswordSent,
    setForgotPasswordSent,
    registerLegalConsent,
    submitting,
    googleOAuthBusy,
    startGoogleOAuth,
    loginProps,
    registerProps,
    resetProps,
  } = props

  const { isRussia } = useGeo()
  const isMobile = useIsMobile()
  const showGoogleOAuth = !isRussia
  const [mobileViewportHeight, setMobileViewportHeight] = useState('100vh')

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return undefined
    const updateViewportHeight = () => {
      setMobileViewportHeight(`${window.visualViewport.height}px`)
    }
    window.visualViewport.addEventListener('resize', updateViewportHeight)
    updateViewportHeight()
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight)
    }
  }, [isMobile])

  const mobileMaxHeightStyle = useMemo(
    () => ({ maxHeight: `min(92dvh, calc(${mobileViewportHeight} - 0.5rem))` }),
    [mobileViewportHeight],
  )

  const authBody = (
    <>
      {authMode === 'verification_pending' ? (
        <>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Mail className='h-5 w-5 text-brand' />
              {getUIText('auth_verify_emailTitle', language)}
            </DialogTitle>
          </DialogHeader>
          <div className='py-6 text-center space-y-4'>
            <div className='w-16 h-16 mx-auto bg-brand/15 rounded-full flex items-center justify-center'>
              <Mail className='h-8 w-8 text-brand' />
            </div>
            <p className='text-slate-600'>{getUIText('auth_verify_emailSent', language)}</p>
            <div className='mx-auto max-w-sm space-y-1.5 px-1 text-left'>
              <Label htmlFor='auth-verify-email-field' className='text-sm'>
                {getUIText('email', language)}
              </Label>
              <Input
                id='auth-verify-email-field'
                readOnly
                value={verificationEmail}
                className='text-center font-medium text-slate-900'
                autoFocus
                onFocus={(e) => e.target.select()}
                inputMode='email'
                autoComplete='email'
              />
            </div>
            <p className='text-sm text-slate-500'>{getUIText('auth_verify_emailInstructions', language)}</p>
            <Button variant='outline' onClick={() => setAuthMode('login')} className='mt-4'>
              {getUIText('auth_backToLogin', language)}
            </Button>
          </div>
        </>
      ) : authMode === 'forgot_password' ? (
        <>
          <DialogHeader>
            <DialogTitle>{getUIText('auth_forgot_title', language)}</DialogTitle>
            <DialogDescription>{getUIText('auth_forgot_description', language)}</DialogDescription>
          </DialogHeader>
          <PasswordResetForm
            {...resetProps}
            language={language}
            forgotPasswordSent={forgotPasswordSent}
            setForgotPasswordSent={setForgotPasswordSent}
            setAuthMode={setAuthMode}
          />
        </>
      ) : (
        <>
          <DialogHeader className='pb-2 flex-shrink-0'>
            <DialogTitle className='text-lg'>
              {authMode === 'login' ? getUIText('loginTitle', language) : getUIText('register', language)}
            </DialogTitle>
            <DialogDescription className='text-sm'>
              {authMode === 'login'
                ? getUIText('auth_modal_subtitleLogin', language)
                : getUIText('auth_modal_subtitleRegister', language)}
            </DialogDescription>
          </DialogHeader>

          <div className='mb-3 flex flex-shrink-0 border-b'>
            <button
              type='button'
              onClick={() => {
                setAuthMode('login')
                props.setRegisterLegalConsent(false)
                props.setError('')
              }}
              className={`flex-1 min-h-11 py-2.5 flex items-center justify-center text-sm font-medium transition-colors border-b-2 ${
                authMode === 'login'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {getUIText('auth_modal_tabLogin', language)}
            </button>
            <button
              type='button'
              onClick={() => {
                setAuthMode('register')
                props.setRegisterLegalConsent(false)
                props.setError('')
              }}
              className={`flex-1 min-h-11 py-2.5 flex items-center justify-center text-sm font-medium transition-colors border-b-2 ${
                authMode === 'register'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {getUIText('register', language)}
            </button>
          </div>

          {authMode === 'login' ? (
            <LoginForm {...loginProps} language={language} />
          ) : (
            <RegisterForm {...registerProps} language={language} />
          )}

          {showGoogleOAuth ? (
            <div className='mx-auto mt-5 w-full max-w-[300px] flex-shrink-0 flex flex-col gap-3 pb-1'>
              <div className='relative flex w-full items-center justify-center py-2'>
                <span className='absolute inset-x-0 top-1/2 h-px bg-slate-100' aria-hidden />
                <span className='relative bg-white px-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400'>
                  {getUIText('auth_oauthDivider', language)}
                </span>
              </div>
              <button
                type='button'
                onClick={() => void startGoogleOAuth()}
                disabled={googleOAuthBusy || submitting || (authMode === 'register' && !registerLegalConsent)}
                className='flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-100/80 transition hover:border-brand/30 hover:bg-slate-50/90 hover:shadow-[0_4px_14px_rgba(0,102,102,0.08)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45'
              >
                {googleOAuthBusy ? (
                  <Loader2 className='h-4 w-4 shrink-0 animate-spin text-slate-600' />
                ) : (
                  <GoogleBrandGlyph className='h-5 w-5 shrink-0' />
                )}
                {getUIText('auth_continueGoogle', language)}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={loginModalOpen} onOpenChange={onLoginModalOpenChange}>
        <DrawerContent
          style={mobileMaxHeightStyle}
          className='mt-0 flex w-full max-h-[92dvh] flex-col rounded-t-[24px] border-slate-200 p-0 [&>div:first-child]:mt-3'
        >
          <DrawerHeader className='shrink-0 border-b border-slate-100 px-4 pb-3 pt-1 text-left'>
            <DrawerTitle className='sr-only'>
              {authMode === 'login' ? getUIText('loginTitle', language) : getUIText('register', language)}
            </DrawerTitle>
            <DrawerDescription className='sr-only'>
              {getUIText('auth_modal_subtitleLogin', language)}
            </DrawerDescription>
          </DrawerHeader>
          <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3'>
            {authBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={loginModalOpen} onOpenChange={onLoginModalOpenChange}>
      <DialogContent className='sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto flex flex-col'>
        {authBody}
      </DialogContent>
    </Dialog>
  )
}

export default AuthModalShell
