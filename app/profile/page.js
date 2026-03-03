'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  User, Mail, Phone, Building2, Loader2, CheckCircle, Clock, 
  Briefcase, Link as LinkIcon, MessageSquare, ArrowRight, Shield, 
  Home, Plane, Settings, LogOut, Star
} from 'lucide-react'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
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
  
  // Dashboard Mode (for partners)
  const [dashboardMode, setDashboardMode] = useState('traveling') // 'traveling' | 'hosting'

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const stored = localStorage.getItem('funnyrent_user')
      if (!stored) {
        router.push('/')
        return
      }
      
      const userData = JSON.parse(stored)
      
      // Fetch fresh profile data
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      )
      const profiles = await res.json()
      
      if (profiles && profiles[0]) {
        const profile = profiles[0]
        setUser(profile)
        setDashboardMode(profile.metadata?.dashboard_mode || 'traveling')
        setPartnerForm({
          phone: profile.phone || '',
          socialLink: profile.metadata?.social_link || '',
          experience: profile.metadata?.experience || '',
          portfolio: profile.metadata?.portfolio || ''
        })
      } else {
        setUser(userData)
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    } finally {
      setLoading(false)
    }
  }

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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          phone: partnerForm.phone,
          metadata: {
            ...(user.metadata || {}),
            partner_status: 'PENDING',
            social_link: partnerForm.socialLink,
            experience: partnerForm.experience,
            portfolio: partnerForm.portfolio,
            partner_applied_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
      })
      
      if (!res.ok) throw new Error('Failed to submit application')
      
      const updated = await res.json()
      if (updated && updated[0]) {
        setUser(updated[0])
        localStorage.setItem('funnyrent_user', JSON.stringify({
          ...user,
          metadata: { ...user.metadata, partner_status: 'PENDING' },
          phone: partnerForm.phone
        }))
      }
      
      setShowPartnerModal(false)
      
      toast({
        title: 'Заявка отправлена!',
        description: 'Мы рассмотрим вашу заявку в течение 24 часов'
      })
      
      // Send Telegram notification to admin
      await fetch(`https://api.telegram.org/bot8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '-1003832026983',
          message_thread_id: 17, // NEW_PARTNERS topic
          text: `🤝 <b>НОВАЯ ЗАЯВКА НА ПАРТНЁРСТВО</b>\n\n` +
            `👤 <b>ID:</b> ${user.id}\n` +
            `📧 <b>Email:</b> ${user.email}\n` +
            `📞 <b>Телефон:</b> ${partnerForm.phone}\n` +
            `💬 <b>Соцсети:</b> ${partnerForm.socialLink || 'N/A'}\n` +
            `📝 <b>Опыт:</b> ${partnerForm.experience.slice(0, 100)}...\n\n` +
            `<i>Ожидает модерации</i>`,
          parse_mode: 'HTML'
        })
      })
      
    } catch (error) {
      console.error('Failed to submit partner application:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить заявку',
        variant: 'destructive'
      })
    } finally {
      setApplyingPartner(false)
    }
  }

  // Toggle Dashboard Mode (for partners)
  async function toggleDashboardMode(mode) {
    setDashboardMode(mode)
    
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metadata: {
            ...(user.metadata || {}),
            dashboard_mode: mode
          }
        })
      })
      
      // Navigate to appropriate dashboard
      if (mode === 'hosting') {
        router.push('/partner/dashboard')
      } else {
        router.push('/my-bookings')
      }
    } catch (error) {
      console.error('Failed to toggle mode:', error)
    }
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem('funnyrent_user')
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

  const isPartner = user.role === 'PARTNER'
  const isPendingPartner = user.metadata?.partner_status === 'PENDING'
  const isRenter = user.role === 'RENTER' && !isPendingPartner

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

        {/* Partner Mode Toggle (for approved partners) */}
        {isPartner && (
          <Card className='mb-6 border-teal-200 bg-teal-50/50'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center gap-2'>
                <Star className='h-4 w-4 text-teal-600' />
                Режим панели
              </CardTitle>
              <CardDescription>
                Переключайтесь между режимами арендатора и хозяина
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-3'>
                <Button
                  variant={dashboardMode === 'traveling' ? 'default' : 'outline'}
                  className={dashboardMode === 'traveling' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  onClick={() => toggleDashboardMode('traveling')}
                >
                  <Plane className='h-4 w-4 mr-2' />
                  Путешествую
                </Button>
                <Button
                  variant={dashboardMode === 'hosting' ? 'default' : 'outline'}
                  className={dashboardMode === 'hosting' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  onClick={() => toggleDashboardMode('hosting')}
                >
                  <Home className='h-4 w-4 mr-2' />
                  Сдаю жильё
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
                Станьте партнёром FunnyRent
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
                  Всегда оплачивайте через FunnyRent для защиты ваших средств.
                  Не переводите деньги напрямую незнакомым лицам.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partner Application Modal */}
      <Dialog open={showPartnerModal} onOpenChange={setShowPartnerModal}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Заявка на партнёрство</DialogTitle>
            <DialogDescription>
              Расскажите о себе и своей недвижимости
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={submitPartnerApplication} className='space-y-4'>
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
                required
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
                rows={3}
                required
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='portfolio'>
                Ссылка на портфолио (необязательно)
              </Label>
              <Input
                id='portfolio'
                type='url'
                placeholder='https://...'
                value={partnerForm.portfolio}
                onChange={(e) => setPartnerForm({ ...partnerForm, portfolio: e.target.value })}
              />
            </div>
            
            <DialogFooter className='pt-4'>
              <Button type='button' variant='outline' onClick={() => setShowPartnerModal(false)}>
                Отмена
              </Button>
              <Button 
                type='submit' 
                className='bg-teal-600 hover:bg-teal-700'
                disabled={applyingPartner}
              >
                {applyingPartner ? (
                  <><Loader2 className='h-4 w-4 mr-2 animate-spin' /> Отправка...</>
                ) : (
                  'Отправить заявку'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
