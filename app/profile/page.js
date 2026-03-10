'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { 
  User, Mail, Phone, Building2, Loader2, CheckCircle, Clock, 
  Briefcase, Link as LinkIcon, MessageSquare, ArrowRight, Shield,
  Plane, Settings, LogOut, Star
} from 'lucide-react'

// Main export with Suspense wrapper for useSearchParams
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user: authUser, loading: authLoading, isAuthenticated, openLoginModal } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Partner Application
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [partnerForm, setPartnerForm] = useState({
    phone: '',
    socialLink: '',
    experience: '',
    portfolio: ''
  })
  const [applyingPartner, setApplyingPartner] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [verificationDocUrl, setVerificationDocUrl] = useState(null)
  
  // Partner application status
  const [isPendingPartner, setIsPendingPartner] = useState(false)
  const [isRejectedPartner, setIsRejectedPartner] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  
  // Welcome celebration for new partners
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated && authUser) {
        setUser(authUser)
        setPartnerForm({
          phone: authUser.phone || '',
          socialLink: '',
          experience: '',
          portfolio: ''
        })
        setLoading(false)
      } else {
        // Not authenticated - check if login=true param exists
        const loginParam = searchParams?.get('login')
        if (loginParam === 'true' && openLoginModal) {
          openLoginModal('login')
        } else {
          // Redirect to home if not trying to login
          router.push('/')
        }
      }
    }
  }, [authLoading, isAuthenticated, authUser, searchParams, openLoginModal, router])

  // Submit Partner Application
  async function submitPartnerApplication(e) {
    e.preventDefault()
    
    if (!partnerForm.phone || !partnerForm.experience) {
      toast({
        title: 'Заполните обязательные поля',
        description: 'Телефон и опыт обязательны',
        variant: 'destructive'
      })
      return
    }
    
    setApplyingPartner(true)
    
    try {
      // Use server API instead of direct Supabase call
      const res = await fetch('/api/v2/partner/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: partnerForm.phone,
          socialLink: partnerForm.socialLink || '',
          experience: partnerForm.experience,
          portfolio: partnerForm.portfolio || '',
          verificationDocUrl: verificationDocUrl || ''
        })
      })
      
      const result = await res.json()
      
      // Handle authentication error
      if (res.status === 401) {
        toast({
          title: 'Сессия истекла',
          description: 'Пожалуйста, войдите в систему снова',
          variant: 'destructive'
        })
        setShowPartnerModal(false)
        // Clear local storage and trigger re-login
        localStorage.removeItem('gostaylo_user')
        window.location.reload()
        return
      }
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit application')
      }
      
      // Update local pending state
      setIsPendingPartner(true)
      
      // Update auth context user via event
      window.dispatchEvent(new CustomEvent('auth-change', { 
        detail: { ...user } 
      }))
      
      // Mark as applied for success page
      localStorage.setItem('gostaylo_partner_applied', 'true')
      
      setShowPartnerModal(false)
      
      // Redirect to success page
      router.push(result.redirectTo || '/partner-application-success')
      
    } catch (error) {
      console.error('Failed to submit partner application:', error)
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить заявку. Попробуйте ещё раз.',
        variant: 'destructive'
      })
    } finally {
      setApplyingPartner(false)
    }
  }

  // Check for pending/rejected partner application
  useEffect(() => {
    async function checkPendingApplication() {
      if (user && user.role !== 'PARTNER') {
        try {
          const res = await fetch(`/api/v2/partner/application-status`, {
            credentials: 'include'
          })
          const result = await res.json()
          if (result.success) {
            if (result.status === 'PENDING') {
              setIsPendingPartner(true)
              setIsRejectedPartner(false)
            } else if (result.status === 'REJECTED') {
              setIsRejectedPartner(true)
              setRejectionReason(result.rejectionReason || 'Заявка не соответствует требованиям')
              setIsPendingPartner(false)
            } else {
              setIsPendingPartner(false)
              setIsRejectedPartner(false)
            }
          }
        } catch (e) {
          setIsPendingPartner(false)
          setIsRejectedPartner(false)
        }
      }
    }
    if (user) checkPendingApplication()
  }, [user])
  
  // Check if user just became a partner (show welcome modal)
  useEffect(() => {
    if (user?.role === 'PARTNER') {
      const welcomeShown = localStorage.getItem('gostaylo_partner_welcome_shown')
      const wasApplying = localStorage.getItem('gostaylo_partner_applied')
      
      if (wasApplying && !welcomeShown) {
        // User just got approved!
        setShowWelcomeModal(true)
        localStorage.setItem('gostaylo_partner_welcome_shown', 'true')
        localStorage.removeItem('gostaylo_partner_applied')
      }
    }
  }, [user])
  
  const isPartner = user?.role === 'PARTNER'
  const isRenter = user?.role === 'RENTER' && !isPendingPartner && !isRejectedPartner

  // Logout
  function handleLogout() {
    localStorage.removeItem('gostaylo_user')
    router.push('/')
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className='min-h-screen bg-slate-50'>
      {/* Header */}
      <header className='bg-white border-b sticky top-0 z-10'>
        <div className='container mx-auto px-4 py-4'>
          <div className='flex items-center justify-between'>
            <h1 className='text-xl font-bold text-slate-900'>Мой профиль</h1>
            <Button variant='ghost' size='sm' onClick={() => router.push('/')}>
              На главную
            </Button>
          </div>
        </div>
      </header>

      <div className='container mx-auto px-4 py-6 max-w-2xl'>
        {/* Profile Card */}
        <Card className='mb-6'>
          <CardHeader>
            <div className='flex items-center gap-4'>
              <div className='w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center'>
                <User className='h-8 w-8 text-teal-600' />
              </div>
              <div>
                <CardTitle className='text-lg'>
                  {user.first_name || user.name || user.email?.split('@')[0]}
                </CardTitle>
                <CardDescription className='flex items-center gap-2'>
                  <Mail className='h-3 w-3' />
                  {user.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-2 mb-4'>
              <Badge className={
                isPartner ? 'bg-teal-100 text-teal-700' :
                isPendingPartner ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-700'
              }>
                {isPartner ? (
                  <><Building2 className='h-3 w-3 mr-1' /> Партнёр</>
                ) : isPendingPartner ? (
                  <><Clock className='h-3 w-3 mr-1' /> Заявка на рассмотрении</>
                ) : (
                  <><User className='h-3 w-3 mr-1' /> Арендатор</>
                )}
              </Badge>
              {user.phone && (
                <Badge variant='outline' className='gap-1'>
                  <Phone className='h-3 w-3' />
                  {user.phone}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Partner Dashboard Link (for approved partners) */}
        {isPartner && (
          <Card className='mb-6 border-teal-200 bg-gradient-to-br from-teal-50 to-white'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center'>
                    <Briefcase className='h-5 w-5 text-teal-600' />
                  </div>
                  <div>
                    <p className='font-semibold text-slate-900'>Панель партнёра</p>
                    <p className='text-sm text-slate-500'>Управляйте объявлениями и бронированиями</p>
                  </div>
                </div>
                <Button 
                  className='bg-teal-600 hover:bg-teal-700'
                  onClick={() => router.push('/partner/dashboard')}
                >
                  Открыть
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Become a Partner CTA (for renters only) */}
        {isRenter && (
          <Card className='mb-6 border-2 border-dashed border-teal-300 bg-gradient-to-br from-teal-50 to-white'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-teal-800'>
                <Briefcase className='h-5 w-5' />
                Станьте партнёром Gostaylo
              </CardTitle>
              <CardDescription>
                Сдавайте свою недвижимость и получайте доход. Присоединяйтесь к нашей сети владельцев на Пхукете.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-3 gap-4 mb-6 text-center'>
                <div>
                  <div className='text-2xl font-bold text-teal-600'>0%</div>
                  <div className='text-xs text-slate-500'>Комиссия первый месяц</div>
                </div>
                <div>
                  <div className='text-2xl font-bold text-teal-600'>24/7</div>
                  <div className='text-xs text-slate-500'>Поддержка</div>
                </div>
                <div>
                  <div className='text-2xl font-bold text-teal-600'>฿</div>
                  <div className='text-xs text-slate-500'>Быстрые выплаты</div>
                </div>
              </div>
              <Button 
                className='w-full bg-teal-600 hover:bg-teal-700'
                onClick={() => setShowPartnerModal(true)}
              >
                Подать заявку
                <ArrowRight className='h-4 w-4 ml-2' />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending Partner Status */}
        {isPendingPartner && (
          <Card className='mb-6 border-amber-200 bg-amber-50'>
            <CardContent className='pt-6'>
              <div className='flex items-start gap-3'>
                <Clock className='h-5 w-5 text-amber-600 mt-0.5' />
                <div>
                  <h3 className='font-medium text-amber-800'>Заявка на рассмотрении</h3>
                  <p className='text-sm text-amber-700 mt-1'>
                    Мы проверяем вашу заявку на партнёрство. Обычно это занимает до 24 часов.
                    Вы получите уведомление по email.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected Partner Status */}
        {isRejectedPartner && (
          <Card className='mb-6 border-red-200 bg-red-50'>
            <CardContent className='pt-6'>
              <div className='flex items-start gap-3'>
                <Shield className='h-5 w-5 text-red-600 mt-0.5' />
                <div className='flex-1'>
                  <h3 className='font-medium text-red-800'>Заявка отклонена</h3>
                  <p className='text-sm text-red-700 mt-1'>
                    {rejectionReason}
                  </p>
                  <Button
                    onClick={() => {
                      setVerificationDocUrl(null)
                      setShowPartnerModal(true)
                    }}
                    className='mt-3 bg-red-600 hover:bg-red-700'
                    size='sm'
                  >
                    Подать заявку повторно
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Telegram Link Card - Prominent if not linked */}
        {!user?.telegram_id && (
          <Card className='mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50'>
            <CardContent className='pt-6 pb-6'>
              <div className='text-center'>
                <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <MessageSquare className='h-8 w-8 text-blue-600' />
                </div>
                <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                  Оставайтесь на связи!
                </h3>
                <p className='text-sm text-slate-600 mb-4 max-w-sm mx-auto'>
                  Привяжите Telegram, чтобы получать уведомления о бронированиях 
                  и важных событиях мгновенно.
                </p>
                <Button 
                  className='bg-blue-600 hover:bg-blue-700 px-6'
                  onClick={() => {
                    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'GostayloBot'
                    window.open(`https://t.me/${botName}?start=link_${user.id}`, '_blank')
                  }}
                >
                  <MessageSquare className='h-4 w-4 mr-2' />
                  Привязать Telegram
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='text-base'>Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            <Button 
              variant='outline' 
              className='w-full justify-start'
              onClick={() => router.push('/my-bookings')}
            >
              <Plane className='h-4 w-4 mr-2 text-slate-500' />
              Мои бронирования
            </Button>
            {isPartner && (
              <Button 
                variant='outline' 
                className='w-full justify-start'
                onClick={() => router.push('/partner/dashboard')}
              >
                <Building2 className='h-4 w-4 mr-2 text-slate-500' />
                Панель партнёра
              </Button>
            )}
            {/* Telegram Status in Quick Actions */}
            {user?.telegram_id ? (
              <div className='flex items-center justify-between p-2 rounded-md bg-green-50 border border-green-200'>
                <div className='flex items-center gap-2'>
                  <MessageSquare className='h-4 w-4 text-green-600' />
                  <span className='text-sm text-green-700'>Telegram привязан</span>
                </div>
                <CheckCircle className='h-4 w-4 text-green-600' />
              </div>
            ) : null}
            <Button 
              variant='outline' 
              className='w-full justify-start'
              onClick={() => router.push('/settings')}
            >
              <Settings className='h-4 w-4 mr-2 text-slate-500' />
              Настройки
            </Button>
            <Button 
              variant='outline' 
              className='w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50'
              onClick={handleLogout}
            >
              <LogOut className='h-4 w-4 mr-2' />
              Выйти
            </Button>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className='border-slate-200 bg-slate-50'>
          <CardContent className='pt-6'>
            <div className='flex items-start gap-3'>
              <Shield className='h-5 w-5 text-slate-500 mt-0.5' />
              <div>
                <h3 className='font-medium text-slate-700 text-sm'>Безопасность</h3>
                <p className='text-xs text-slate-500 mt-1'>
                  Всегда оплачивайте через Gostaylo для защиты ваших средств.
                  Не переводите деньги напрямую незнакомым лицам.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partner Application Modal - Mobile Optimized */}
      <Dialog open={showPartnerModal} onOpenChange={setShowPartnerModal}>
        <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='sticky top-0 bg-white pb-2 z-10'>
            <DialogTitle>Заявка на партнёрство</DialogTitle>
            <DialogDescription>
              Расскажите о себе и своей недвижимости
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={submitPartnerApplication} className='space-y-4 pb-4'>
            <div className='space-y-2'>
              <Label htmlFor='phone'>
                Телефон <span className='text-red-500'>*</span>
              </Label>
              <Input
                id='phone'
                type='tel'
                placeholder='+66 XX XXX XXXX'
                value={partnerForm.phone}
                onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                required
                className='text-base'
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='socialLink'>
                Telegram / WhatsApp / Соцсети
              </Label>
              <Input
                id='socialLink'
                type='text'
                placeholder='@username или ссылка'
                value={partnerForm.socialLink}
                onChange={(e) => setPartnerForm({ ...partnerForm, socialLink: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className='text-base'
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='experience'>
                Опыт в аренде <span className='text-red-500'>*</span>
              </Label>
              <Textarea
                id='experience'
                placeholder='Расскажите о вашем опыте: сколько объектов, какие типы недвижимости, как давно сдаёте...'
                value={partnerForm.experience}
                onChange={(e) => setPartnerForm({ ...partnerForm, experience: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                rows={3}
                required
                className='text-base resize-none'
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='portfolio'>
                Ссылка на портфолио <span className='text-slate-400 text-xs font-normal'>(необязательно)</span>
              </Label>
              <Input
                id='portfolio'
                type='text'
                placeholder='airbnb.com/users/... или booking.com/...'
                value={partnerForm.portfolio}
                onChange={(e) => setPartnerForm({ ...partnerForm, portfolio: e.target.value })}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className='text-base'
              />
              <p className='text-xs text-slate-500'>
                Ссылка на ваш профиль на Airbnb, Booking или сайт с объектами
              </p>
            </div>
            
            {/* KYC Document Upload */}
            <div className='space-y-2'>
              <Label htmlFor='verificationDoc'>
                Документ (паспорт/ID) <span className='text-slate-400 text-xs font-normal'>(рекомендуется)</span>
              </Label>
              <div className='border-2 border-dashed rounded-lg p-4 text-center'>
                {verificationDocUrl ? (
                  <div className='space-y-2'>
                    <CheckCircle className='h-8 w-8 text-green-500 mx-auto' />
                    <p className='text-sm text-green-600 font-medium'>Документ загружен</p>
                    <p className='text-xs text-slate-400 break-all px-2'>
                      {verificationDocUrl.split('/').pop()?.slice(0, 30)}...
                    </p>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => setVerificationDocUrl(null)}
                    >
                      Удалить
                    </Button>
                  </div>
                ) : uploadingDoc ? (
                  <div className='space-y-2'>
                    <Loader2 className='h-8 w-8 animate-spin text-teal-600 mx-auto' />
                    <p className='text-sm text-slate-500'>Сжатие и загрузка...</p>
                  </div>
                ) : (
                  <label className='cursor-pointer block'>
                    <input
                      type='file'
                      accept='image/jpeg,image/png,image/webp,application/pdf'
                      className='hidden'
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        setUploadingDoc(true)
                        try {
                          let fileToUpload = file
                          
                          // Compress image files (not PDFs)
                          if (file.type.startsWith('image/')) {
                            const imageCompression = (await import('browser-image-compression')).default
                            
                            const options = {
                              maxSizeMB: 1,
                              maxWidthOrHeight: 1200,
                              useWebWorker: true,
                              initialQuality: 0.8
                            }
                            
                            try {
                              fileToUpload = await imageCompression(file, options)
                              console.log('Compressed:', file.size, '->', fileToUpload.size)
                            } catch (compressErr) {
                              console.error('Compression error:', compressErr)
                              // Continue with original file if compression fails
                            }
                          }
                          
                          // Check size after compression (Vercel limit)
                          if (fileToUpload.size > 4 * 1024 * 1024) {
                            throw new Error('Файл слишком большой. Попробуйте файл меньшего размера.')
                          }
                          
                          const formData = new FormData()
                          formData.append('file', fileToUpload)
                          formData.append('bucket', 'verification_documents')
                          
                          const res = await fetch('/api/v2/upload', {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                          })
                          
                          const result = await res.json()
                          
                          if (!res.ok || !result.success) {
                            throw new Error(result.error || 'Upload failed. Try a smaller file.')
                          }
                          
                          setVerificationDocUrl(result.url)
                          toast({ 
                            title: 'Документ загружен',
                            description: 'Файл успешно сохранён'
                          })
                        } catch (err) {
                          console.error('Upload error:', err)
                          toast({
                            title: 'Ошибка загрузки',
                            description: err.message || 'Upload failed. Try a smaller file.',
                            variant: 'destructive'
                          })
                          setVerificationDocUrl(null)
                        } finally {
                          setUploadingDoc(false)
                          // Reset file input
                          e.target.value = ''
                        }
                      }}
                    />
                    <Shield className='h-8 w-8 text-slate-400 mx-auto mb-2' />
                    <p className='text-sm text-slate-600'>Нажмите для загрузки</p>
                    <p className='text-xs text-slate-400 mt-1'>JPG, PNG или PDF (до 4MB)</p>
                  </label>
                )}
              </div>
              <p className='text-xs text-slate-500'>
                Ускоряет проверку заявки. Документ виден только администратору.
              </p>
            </div>
            
            {/* Sticky Footer for Mobile */}
            <div className='sticky bottom-0 bg-white pt-4 pb-2 border-t mt-4 -mx-6 px-6'>
              <div className='flex gap-3'>
                <Button 
                  type='button' 
                  variant='outline' 
                  onClick={() => setShowPartnerModal(false)}
                  className='flex-1'
                  disabled={applyingPartner}
                >
                  Отмена
                </Button>
                <Button 
                  type='submit' 
                  className='flex-1 bg-teal-600 hover:bg-teal-700'
                  disabled={applyingPartner}
                >
                  {applyingPartner ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
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

      {/* Welcome Partner Celebration Modal */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className='sm:max-w-md'>
          <div className='text-center py-6'>
            {/* Confetti/Celebration Icon */}
            <div className='relative mx-auto mb-4'>
              <div className='w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mx-auto animate-bounce'>
                <Star className='h-10 w-10 text-white' />
              </div>
              <div className='absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-ping' />
              <div className='absolute -bottom-1 -left-3 w-4 h-4 bg-pink-400 rounded-full animate-ping' style={{animationDelay: '0.3s'}} />
              <div className='absolute top-0 -left-4 w-3 h-3 bg-blue-400 rounded-full animate-ping' style={{animationDelay: '0.5s'}} />
            </div>
            
            <h2 className='text-2xl font-bold text-slate-900 mb-2'>
              Добро пожаловать в партнёры!
            </h2>
            <p className='text-slate-600 mb-6'>
              Ваша заявка одобрена. Теперь вы можете добавлять свои объекты 
              и получать бронирования через Gostaylo.
            </p>
            
            <div className='space-y-3'>
              <Button 
                className='w-full bg-teal-600 hover:bg-teal-700'
                onClick={() => {
                  setShowWelcomeModal(false)
                  router.push('/partner/dashboard')
                }}
              >
                <Building2 className='h-4 w-4 mr-2' />
                Перейти в панель партнёра
              </Button>
              <Button 
                variant='outline'
                className='w-full'
                onClick={() => setShowWelcomeModal(false)}
              >
                Остаться на странице
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
