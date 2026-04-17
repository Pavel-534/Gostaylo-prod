'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Loader2, CheckCircle, XCircle, User, Mail, Phone, 
  Link as LinkIcon, FileText, Clock, ExternalLink, ArrowLeft, Shield
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
import { toAdminVerificationDocProxyUrl } from '@/lib/verification-doc-admin-url'

export default function AdminPartnersPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [user, setUser] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  
  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingUser, setRejectingUser] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    // Get user from localStorage first for quick check
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      
      if (parsed.role === 'ADMIN') {
        loadApplications()
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  async function loadApplications() {
    try {
      const res = await fetch('/api/v2/admin/partners', {
        credentials: 'include'
      })
      const result = await res.json()
      
      if (result.success) {
        setApplications(result.applications || [])
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load applications:', error)
      setLoading(false)
    }
  }

  async function approvePartner(userId) {
    setProcessingId(userId)
    
    try {
      const res = await fetch('/api/v2/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          userId
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        setApplications(prev => prev.filter(a => a.id !== userId))
        toast({
          title: 'Партнёр одобрен',
          description: 'Пользователь получил уведомление'
        })
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
      setProcessingId(null)
    }
  }

  async function rejectPartner() {
    if (!rejectingUser) return
    
    setProcessingId(rejectingUser.id)
    
    try {
      const res = await fetch('/api/v2/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          userId: rejectingUser.id,
          reason: rejectReason || 'Заявка не соответствует требованиям'
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        setApplications(prev => prev.filter(a => a.id !== rejectingUser.id))
        setShowRejectModal(false)
        setRejectingUser(null)
        setRejectReason('')
        toast({
          title: 'Заявка отклонена',
          description: 'Пользователь получил уведомление'
        })
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
      setProcessingId(null)
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

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Заявки на партнёрство</h1>
              <p className="text-sm text-slate-500">
                {applications.length} {applications.length === 1 ? 'заявка' : 'заявок'} ожидает рассмотрения
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-slate-600">Нет заявок на рассмотрение</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applications.map(app => (
              <Card 
                key={app.id} 
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/admin/partners/${app.application_id}`)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4">
                    {/* Header: Avatar + Name + Badge */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                          {app.first_name || app.name || 'Без имени'}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 truncate">
                          {app.email}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 text-xs flex-shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Ожидает</span>
                      </Badge>
                    </div>

                    {/* Contact Info - Compact on mobile */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{app.phone || 'Нет'}</span>
                      </div>
                      {app.metadata?.social_link && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{app.metadata.social_link}</span>
                        </div>
                      )}
                    </div>

                    {/* Experience Preview */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">Опыт</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                        {app.metadata?.experience || 'Не указан'}
                      </p>
                    </div>

                    {app.verification_doc_url ? (
                      <div className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-4 w-4 text-teal-600 shrink-0" aria-hidden />
                        <a
                          href={toAdminVerificationDocProxyUrl(app.verification_doc_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 hover:underline font-medium truncate"
                        >
                          Документ KYC (открыть)
                        </a>
                      </div>
                    ) : null}

                    {/* Footer: Date + Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-xs text-slate-400">
                        {new Date(app.metadata?.partner_applied_at || app.created_at).toLocaleString('ru-RU')}
                      </p>
                      
                      {/* Actions */}
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          onClick={() => approvePartner(app.id)}
                          disabled={processingId === app.id}
                          size="sm"
                          className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 h-9"
                        >
                          {processingId === app.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Одобрить</span>
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setRejectingUser(app)
                            setShowRejectModal(true)
                          }}
                          disabled={processingId === app.id}
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 h-9"
                        >
                          <XCircle className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Отклонить</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
              <p className="text-sm text-slate-600">{rejectingUser?.email}</p>
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
              disabled={processingId === rejectingUser?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {processingId === rejectingUser?.id ? (
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
