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
              <Card key={app.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* User Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {app.first_name || app.name || 'Без имени'}
                          </h3>
                          <p className="text-sm text-slate-500">{app.email}</p>
                        </div>
                        <Badge className="ml-auto bg-amber-100 text-amber-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Ожидает
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="h-4 w-4" />
                          <span>{app.phone || 'Не указан'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="h-4 w-4" />
                          <span>{app.metadata?.social_link || 'Не указано'}</span>
                        </div>
                        {app.metadata?.portfolio && (
                          <div className="flex items-center gap-2 text-slate-600 col-span-2">
                            <LinkIcon className="h-4 w-4" />
                            <a 
                              href={app.metadata.portfolio} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-teal-600 hover:underline flex items-center gap-1"
                            >
                              {app.metadata.portfolio}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Experience */}
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">Опыт</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {app.metadata?.experience || 'Не указан'}
                        </p>
                      </div>

                      <p className="text-xs text-slate-400">
                        Заявка подана: {new Date(app.metadata?.partner_applied_at || app.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-col gap-2 lg:w-40">
                      <Button
                        onClick={() => approvePartner(app.id)}
                        disabled={processingId === app.id}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {processingId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Одобрить
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
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Отклонить
                      </Button>
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
