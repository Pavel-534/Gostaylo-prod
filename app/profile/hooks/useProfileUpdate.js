'use client'

import { useState, useCallback } from 'react'

/**
 * Partner application + KYC doc PATCH via API (Supabase through routes).
 */
export function useProfileUpdate({ toast, router, onAfterPartnerSuccess }) {
  const [applyingPartner, setApplyingPartner] = useState(false)
  const [savingPendingKyc, setSavingPendingKyc] = useState(false)

  const submitPartnerApplication = useCallback(
    async (partnerForm, verificationDocUrl, user) => {
      if (!partnerForm.phone || !partnerForm.experience) {
        toast({
          title: 'Заполните обязательные поля',
          description: 'Телефон и опыт обязательны',
          variant: 'destructive',
        })
        return
      }
      if (!String(verificationDocUrl || '').trim()) {
        toast({
          title: 'Нужен документ',
          description: 'Загрузите паспорт или ID для проверки заявки',
          variant: 'destructive',
        })
        return
      }

      setApplyingPartner(true)
      try {
        const res = await fetch('/api/v2/partner/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            phone: partnerForm.phone,
            socialLink: partnerForm.socialLink || '',
            experience: partnerForm.experience,
            portfolio: partnerForm.portfolio || '',
            verificationDocUrl: verificationDocUrl || '',
          }),
        })

        const result = await res.json()

        if (res.status === 401) {
          toast({
            title: 'Сессия истекла',
            description: 'Пожалуйста, войдите в систему снова',
            variant: 'destructive',
          })
          if (onAfterPartnerSuccess?.closeModal) onAfterPartnerSuccess.closeModal()
          localStorage.removeItem('gostaylo_user')
          window.location.reload()
          return
        }

        if (!res.ok || !result.success) {
          throw new Error(result.error || 'Failed to submit application')
        }

        window.dispatchEvent(new CustomEvent('auth-change', { detail: { ...user } }))
        localStorage.setItem('gostaylo_partner_applied', 'true')
        onAfterPartnerSuccess?.onSubmitted?.()
        if (onAfterPartnerSuccess?.closeModal) onAfterPartnerSuccess.closeModal()
        router.push(result.redirectTo || '/partner-application-success')
      } catch (error) {
        console.error('Failed to submit partner application:', error)
        toast({
          title: 'Ошибка',
          description: error.message || 'Не удалось отправить заявку. Попробуйте ещё раз.',
          variant: 'destructive',
        })
      } finally {
        setApplyingPartner(false)
      }
    },
    [toast, router, onAfterPartnerSuccess],
  )

  const savePendingKyc = useCallback(
    async (docUrl) => {
      const doc = String(docUrl || '').trim()
      if (!doc) {
        toast({ title: 'Нужен файл', description: 'Загрузите документ', variant: 'destructive' })
        return
      }
      setSavingPendingKyc(true)
      try {
        const res = await fetch('/api/v2/partner/applications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ verificationDocUrl: doc }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Не удалось сохранить')
        }
        toast({ title: 'Готово', description: 'Документ прикреплён к заявке' })
        if (onAfterPartnerSuccess?.onKycSaved) {
          await Promise.resolve(onAfterPartnerSuccess.onKycSaved())
        }
      } catch (e) {
        toast({
          title: 'Ошибка',
          description: e.message || 'Не удалось сохранить документ',
          variant: 'destructive',
        })
      } finally {
        setSavingPendingKyc(false)
      }
    },
    [toast, onAfterPartnerSuccess],
  )

  return { submitPartnerApplication, savePendingKyc, applyingPartner, savingPendingKyc }
}
