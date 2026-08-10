'use client'

/**
 * ADR-210 Slice 3 — Concierge partner magic claim (/claim?token=…).
 * No OAuth: password + optional/required phone OTP (RU).
 */

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSiteDisplayName } from '@/lib/site-url'
import { isAuthPasswordCompliant, AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'
import { useGeo } from '@/contexts/geo-context'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'

function ClaimPartnerForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const { isRussia } = useGeo()
  const brand = getSiteDisplayName()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneChallengeId, setPhoneChallengeId] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOtp() {
    setError('')
    setSendingOtp(true)
    try {
      const res = await fetch('/api/v2/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setError(data.error_code || data.error || 'Не удалось отправить код')
        return
      }
      setPhoneChallengeId(String(data.challengeId || ''))
      setOtpSent(true)
      if (data.mockCode) {
        setPhoneOtpCode(String(data.mockCode))
      }
    } catch {
      setError('Не удалось отправить код')
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Ссылка недействительна или устарела')
      return
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (!isAuthPasswordCompliant(password)) {
      setError(
        password.length < AUTH_PASSWORD_MIN_LENGTH
          ? `Минимум ${AUTH_PASSWORD_MIN_LENGTH} символов`
          : 'Пароль: минимум 8 символов, буква и цифра',
      )
      return
    }
    if (isRussia && (!phone || !phoneOtpCode)) {
      setError('Для активации из РФ нужен телефон и код из SMS')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v2/auth/claim-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          phone: phone || undefined,
          phoneOtpCode: phoneOtpCode || undefined,
          phoneChallengeId: phoneChallengeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        const code = data.code || data.error_code
        if (code === 'EMAIL_ALREADY_REGISTERED') {
          setError('Этот email уже зарегистрирован. Войдите в существующий аккаунт или обратитесь в поддержку.')
        } else if (code === 'INVALID_OR_EXPIRED_TOKEN') {
          setError('Ссылка недействительна или истекла. Запросите новую у команды Concierge.')
        } else if (code === 'PHONE_OTP_REQUIRED' || code === 'AUTH_PHONE_OTP_INVALID') {
          setError('Подтвердите телефон кодом из SMS')
        } else {
          setError(data.error || 'Не удалось активировать кабинет')
        }
        return
      }
      router.replace(data.redirectTo || '/partner/listings?concierge_welcome=true')
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthPageShell
        title="Ссылка недействительна"
        subtitle="Откройте письмо с приглашением Concierge или запросите новую ссылку у поддержки."
        backHref="/auth/login"
      >
        <Button variant="brand" className="w-full min-h-[44px]" onClick={() => router.push('/auth/login')}>
          Войти
        </Button>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Активация кабинета партнёра"
      subtitle={`Мы подготовили объявления в ${brand}. Задайте пароль${isRussia ? ' и подтвердите телефон' : ''} — после входа откроется партнёрский кабинет. Выплаты — после отдельной верификации.`}
      backHref="/auth/login"
    >
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="claim-password">Пароль</Label>
          <Input
            id="claim-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claim-password-confirm">Повтор пароля</Label>
          <Input
            id="claim-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="min-h-[44px]"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claim-phone">
            Телефон{isRussia ? ' (обязательно)' : ' (необязательно)'}
          </Label>
          <Input
            id="claim-phone"
            type="tel"
            inputMode="tel"
            placeholder="+7…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-[44px]"
            required={isRussia}
          />
        </div>

        {isRussia || phone ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="claim-otp">Код из SMS{isRussia ? '' : ' (если отправляли)'}</Label>
              <Input
                id="claim-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={phoneOtpCode}
                onChange={(e) => setPhoneOtpCode(e.target.value)}
                className="min-h-[44px]"
                required={isRussia}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={sendingOtp || !phone}
              onClick={sendOtp}
            >
              {otpSent ? 'Отправить снова' : sendingOtp ? 'Отправка…' : 'Получить код'}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="brand" className="mt-auto w-full min-h-[44px]" disabled={loading}>
          {loading ? 'Активация…' : 'Активировать кабинет'}
        </Button>
      </form>
    </AuthPageShell>
  )
}

export default function ClaimPartnerPage() {
  return (
    <Suspense fallback={<LoadingPageShell label="Загрузка…" />}>
      <ClaimPartnerForm />
    </Suspense>
  )
}
