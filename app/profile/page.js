'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, Star, Building2 } from 'lucide-react'
import { KycUploader } from '@/components/kyc-uploader'
import { useProfileUpdate } from '@/app/profile/hooks/useProfileUpdate'
import { ProfileInfo } from '@/app/profile/components/ProfileInfo'
import { ProfileSecurity } from '@/app/profile/components/ProfileSecurity'
import { ProfilePreferences } from '@/app/profile/components/ProfilePreferences'
import { getSiteDisplayName } from '@/lib/site-url'

const KYC_LABELS = {
  label: 'Документ (паспорт/ID)',
  requiredBadge: '*',
  uploading: 'Сжатие и загрузка…',
  uploaded: 'Документ загружен',
  remove: 'Удалить',
  tapToUpload: 'Нажмите для загрузки',
  fileTypesHint: 'JPG, PNG или PDF (до 4MB)',
  privacyHint: 'Виден только администраторам.',
  errorTooLarge: 'Файл слишком большой.',
  errorUploadFailed: 'Ошибка загрузки',
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user: authUser, loading: authLoading, isAuthenticated, openLoginModal, refreshUserFromServer } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [partnerForm, setPartnerForm] = useState({
    phone: '',
    socialLink: '',
    experience: '',
    portfolio: '',
  })
  const [verificationDocUrl, setVerificationDocUrl] = useState(null)
  const [isPendingPartner, setIsPendingPartner] = useState(false)
  const [pendingNeedsKyc, setPendingNeedsKyc] = useState(false)
  const [pendingInlineKycUrl, setPendingInlineKycUrl] = useState(null)
  const [isRejectedPartner, setIsRejectedPartner] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  const profileSuccessHandlers = useMemo(
    () => ({
      closeModal: () => setShowPartnerModal(false),
      onSubmitted: () => setIsPendingPartner(true),
      onKycSaved: async () => {
        setPendingInlineKycUrl(null)
        setPendingNeedsKyc(false)
        try {
          const st = await fetch('/api/v2/partner/application-status', { credentials: 'include' })
          const j = await st.json().catch(() => ({}))
          if (j.success && j.status === 'PENDING') {
            setPendingNeedsKyc(!j.hasVerificationDoc)
          }
        } catch {
          /* ignore */
        }
      },
    }),
    [],
  )

  const { submitPartnerApplication, savePendingKyc, applyingPartner, savingPendingKyc } = useProfileUpdate({
    toast,
    router,
    onAfterPartnerSuccess: profileSuccessHandlers,
  })

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated && authUser) {
        setUser(authUser)
        setPartnerForm({
          phone: authUser.phone || '',
          socialLink: '',
          experience: '',
          portfolio: '',
        })
        setLoading(false)
      } else {
        const loginParam = searchParams?.get('login')
        if (loginParam === 'true' && openLoginModal) {
          openLoginModal('login')
        } else {
          router.push('/')
        }
      }
    }
  }, [authLoading, isAuthenticated, authUser, searchParams, openLoginModal, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated || !authUser?.id) return
    refreshUserFromServer()
  }, [authLoading, isAuthenticated, authUser?.id, refreshUserFromServer])

  useEffect(() => {
    async function checkPendingApplication() {
      if (user && user.role !== 'PARTNER') {
        try {
          const res = await fetch(`/api/v2/partner/application-status`, { credentials: 'include' })
          const result = await res.json()
          if (result.success) {
            if (result.status === 'PENDING') {
              setIsPendingPartner(true)
              setIsRejectedPartner(false)
              setPendingNeedsKyc(!result.hasVerificationDoc)
            } else if (result.status === 'REJECTED') {
              setIsRejectedPartner(true)
              setRejectionReason(result.rejectionReason || 'Заявка не соответствует требованиям')
              setIsPendingPartner(false)
              setPendingNeedsKyc(false)
            } else {
              setIsPendingPartner(false)
              setIsRejectedPartner(false)
              setPendingNeedsKyc(false)
            }
          }
        } catch {
          setIsPendingPartner(false)
          setIsRejectedPartner(false)
          setPendingNeedsKyc(false)
        }
      }
    }
    if (user) checkPendingApplication()
  }, [user])

  useEffect(() => {
    if (user?.role === 'PARTNER') {
      const welcomeShown = localStorage.getItem('gostaylo_partner_welcome_shown')
      const wasApplying = localStorage.getItem('gostaylo_partner_applied')
      if (wasApplying && !welcomeShown) {
        setShowWelcomeModal(true)
        localStorage.setItem('gostaylo_partner_welcome_shown', 'true')
        localStorage.removeItem('gostaylo_partner_applied')
      }
    }
  }, [user])

  const isPartner = user?.role === 'PARTNER'
  const isRenter = user?.role === 'RENTER' && !isPendingPartner && !isRejectedPartner

  function handleLogout() {
    localStorage.removeItem('gostaylo_user')
    router.push('/')
  }

  function onSubmitPartnerForm(e) {
    e.preventDefault()
    void submitPartnerApplication(partnerForm, verificationDocUrl, user)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Мой профиль</h1>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              На главную
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <ProfileInfo
          user={user}
          isPartner={isPartner}
          isRenter={isRenter}
          isPendingPartner={isPendingPartner}
          isRejectedPartner={isRejectedPartner}
          pendingNeedsKyc={pendingNeedsKyc}
          pendingInlineKycUrl={pendingInlineKycUrl}
          onPendingKycUrlChange={setPendingInlineKycUrl}
          savingPendingKyc={savingPendingKyc}
          onSavePendingKyc={() => void savePendingKyc(pendingInlineKycUrl)}
          rejectionReason={rejectionReason}
          onRetryPartner={() => {
            setVerificationDocUrl(null)
            setShowPartnerModal(true)
          }}
          onOpenPartnerModal={() => setShowPartnerModal(true)}
          toast={toast}
          router={router}
        />

        <ProfilePreferences user={user} isPartner={isPartner} onLogout={handleLogout} router={router} />

        <ProfileSecurity user={user} onToast={(o) => toast(o)} />
      </div>

      <Dialog open={showPartnerModal} onOpenChange={setShowPartnerModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white pb-2 z-10">
            <DialogTitle>Заявка на партнёрство</DialogTitle>
            <DialogDescription>Расскажите о себе и своей недвижимости</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={onSubmitPartnerForm}
            className="space-y-4 pb-4"
          >
            <div className="space-y-2">
              <Label htmlFor="phone">
                Телефон <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+66 XX XXX XXXX"
                value={partnerForm.phone}
                onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="socialLink">Telegram / WhatsApp / Соцсети</Label>
              <Input
                id="socialLink"
                type="text"
                placeholder="@username или ссылка"
                value={partnerForm.socialLink}
                onChange={(e) => setPartnerForm({ ...partnerForm, socialLink: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">
                Опыт в аренде <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="experience"
                placeholder="Расскажите о вашем опыте: сколько объектов, какие типы недвижимости, как давно сдаёте..."
                value={partnerForm.experience}
                onChange={(e) => setPartnerForm({ ...partnerForm, experience: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                rows={3}
                required
                className="text-base resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio">Ссылка на портфолио (необязательно)</Label>
              <Input
                id="portfolio"
                type="text"
                placeholder="airbnb.com/users/... или booking.com/..."
                value={partnerForm.portfolio}
                onChange={(e) => setPartnerForm({ ...partnerForm, portfolio: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="text-base"
              />
            </div>
            <KycUploader
              value={verificationDocUrl}
              onChange={setVerificationDocUrl}
              disabled={applyingPartner}
              strings={KYC_LABELS}
              onUploadError={(msg) => toast({ title: 'Ошибка загрузки', description: msg, variant: 'destructive' })}
              onUploadSuccess={() => toast({ title: 'Документ загружен', description: 'Файл успешно сохранён' })}
            />
            <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t mt-4 -mx-6 px-6">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPartnerModal(false)}
                  className="flex-1"
                  disabled={applyingPartner}
                >
                  Отмена
                </Button>
                <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={applyingPartner}>
                  {applyingPartner ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    'Отправить заявку'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="relative mx-auto mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <Star className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Добро пожаловать в партнёры!</h2>
            <p className="text-slate-600 mb-6">
              Ваша заявка одобрена. Теперь вы можете добавлять свои объекты и получать бронирования через{' '}
              {getSiteDisplayName()}.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setShowWelcomeModal(false)
                  router.push('/partner/dashboard')
                }}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Перейти в панель партнёра
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowWelcomeModal(false)}>
                Остаться на странице
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
