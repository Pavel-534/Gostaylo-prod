'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Loader2, CheckCircle, XCircle, User, Mail, Phone, 
  Link as LinkIcon, FileText, Clock, ExternalLink, ArrowLeft, 
  Shield, Calendar, MessageSquare, Briefcase
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { ProxiedImage } from '@/components/proxied-image'

export default function PartnerApplicationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  
  const [user, setUser] = useState(null)
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    // Get user from localStorage first for quick check
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      
      if (parsed.role === 'ADMIN') {
        loadApplication()
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [params.id])

  async function loadApplication() {
    try {
      const res = await fetch('/api/v2/admin/partners', {
        credentials: 'include'
      })
      const result = await res.json()
      
      if (result.success) {
        // Find the specific application
        const app = result.applications?.find(a => a.application_id === params.id)
        if (app) {
          setApplication(app)
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load application:', error)
      setLoading(false)
    }
  }

  async function approvePartner() {
    setProcessing(true)
    
    try {
      const res = await fetch('/api/v2/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          userId: application.id
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast({
          title: 'Партнёр одобрен',
          description: 'Пользователь получил уведомление'
        })
        router.push('/admin/partners')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  async function rejectPartner() {
    setProcessing(true)
    
    try {
      const res = await fetch('/api/v2/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          userId: application.id,
          reason: rejectReason || 'Заявка не соответствует требованиям'
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        setShowRejectModal(false)
        toast({
          title: 'Заявка отклонена',
          description: 'Пользователь получил уведомление'
        })
        router.push('/admin/partners')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Shield className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-slate-600 text-lg">Доступ запрещён</p>
        <p className="text-slate-500 text-sm mt-1">Только для администраторов</p>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <FileText className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-slate-600 text-lg">Заявка не найдена</p>
        <p className="text-slate-500 text-sm mt-1">Возможно, она уже обработана</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin/partners">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К списку заявок
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/partners">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                Заявка на партнёрство
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                ID: {params.id?.slice(0, 8)}...
              </p>
            </div>
            <Badge className="bg-amber-100 text-amber-700">
              <Clock className="h-3 w-3 mr-1" />
              Ожидает
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        
        {/* User Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-teal-600" />
              Информация о пользователе
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {application.first_name || 'Без имени'} {application.last_name || ''}
                </h2>
                <p className="text-sm text-slate-500 break-all">
                  {application.email}
                </p>
              </div>
            </div>
            
            {/* Contact Details */}
            <div className="grid grid-cols-1 gap-3 pt-2 border-t">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{application.phone || 'Не указан'}</span>
              </div>
              
              {application.metadata?.social_link && (
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 break-all">{application.metadata.social_link}</span>
                </div>
              )}
              
              {application.metadata?.portfolio && (
                <div className="flex items-start gap-3">
                  <LinkIcon className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <a 
                    href={application.metadata.portfolio} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:underline break-all flex items-center gap-1"
                  >
                    {application.metadata.portfolio}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500">
                  Регистрация: {new Date(application.user_created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Experience Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-teal-600" />
              Опыт в аренде
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {application.metadata?.experience || 'Не указан'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Verification Document */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              Документ для верификации
            </CardTitle>
          </CardHeader>
          <CardContent>
            {application.verification_doc_url ? (
              <div className="space-y-3">
                {/* Thumbnail or Preview */}
                {application.verification_doc_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <a 
                    href={application.verification_doc_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="relative overflow-hidden rounded-lg border bg-slate-100 min-h-[120px] max-h-72">
                      <ProxiedImage
                        src={application.verification_doc_url}
                        alt="Verification document"
                        width={1200}
                        height={800}
                        className="w-full h-auto max-h-72 object-contain group-hover:scale-105 transition-transform duration-200"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
                  </a>
                ) : (
                  <a 
                    href={application.verification_doc_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition border"
                  >
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">PDF документ</p>
                      <p className="text-xs text-slate-500">Нажмите для открытия</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </a>
                )}
                
                {/* Direct link */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <LinkIcon className="h-3 w-3" />
                  <a 
                    href={application.verification_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-teal-600 transition-colors"
                  >
                    {application.verification_doc_url.split('/').pop()?.slice(0, 40)}
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <Shield className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Документ не загружен</p>
                <p className="text-xs text-slate-400 mt-1">
                  Пользователь не прикрепил ID/паспорт
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Meta */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              <span>Заявка подана:</span>
              <span className="font-medium text-slate-700">
                {new Date(application.metadata?.partner_applied_at || application.created_at).toLocaleString('ru-RU')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Removed placeholder comment */}

        {/* Actions - Fixed at bottom on mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 sm:relative sm:border-0 sm:p-0 sm:pt-4 sm:bg-transparent">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-2xl mx-auto">
            <Button
              onClick={approvePartner}
              disabled={processing}
              className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 h-11 sm:h-12"
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Одобрить партнёра
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowRejectModal(true)}
              disabled={processing}
              variant="outline"
              className="w-full sm:flex-1 text-red-600 border-red-200 hover:bg-red-50 h-11 sm:h-12"
            >
              <XCircle className="h-5 w-5 mr-2" />
              Отклонить
            </Button>
          </div>
        </div>
        
        {/* Spacer for fixed bottom buttons on mobile */}
        <div className="h-28 sm:hidden"></div>
      </div>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить заявку</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения. Она будет отправлена пользователю.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Пользователь</Label>
              <p className="text-sm text-slate-600">{application?.email}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Причина отклонения</Label>
              <Textarea
                id="reason"
                placeholder="Например: недостаточно опыта, неполная информация..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Отмена
            </Button>
            <Button 
              onClick={rejectPartner}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Отклонить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
