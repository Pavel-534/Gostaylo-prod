'use client'

import { User, Mail, Building2, Clock, Briefcase, Phone, ArrowRight, Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KycUploader } from '@/components/kyc-uploader'
import { getSiteDisplayName } from '@/lib/site-url'

const PENDING_KYC_LABELS = {
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

export function ProfileInfo({
  user,
  isPartner,
  isRenter,
  isPendingPartner,
  isRejectedPartner,
  pendingNeedsKyc,
  pendingInlineKycUrl,
  onPendingKycUrlChange,
  savingPendingKyc,
  onSavePendingKyc,
  rejectionReason,
  onRetryPartner,
  onOpenPartnerModal,
  toast,
  router,
}) {
  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {user.first_name || user.name || user.email?.split('@')[0]}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Badge
              className={
                isPartner
                  ? 'bg-teal-100 text-teal-700'
                  : isPendingPartner
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
              }
            >
              {isPartner ? (
                <>
                  <Building2 className="h-3 w-3 mr-1" /> Партнёр
                </>
              ) : isPendingPartner ? (
                <>
                  <Clock className="h-3 w-3 mr-1" /> Заявка на рассмотрении
                </>
              ) : (
                <>
                  <User className="h-3 w-3 mr-1" /> Арендатор
                </>
              )}
            </Badge>
            {user.phone && (
              <Badge variant="outline" className="gap-1">
                <Phone className="h-3 w-3" />
                {user.phone}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {isPartner && (
        <Card className="mb-6 border-teal-200 bg-gradient-to-br from-teal-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Панель партнёра</p>
                  <p className="text-sm text-slate-500">Управляйте объявлениями и бронированиями</p>
                </div>
              </div>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => router.push('/partner/dashboard')}>
                Открыть
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isRenter && (
        <Card className="mb-6 border-2 border-dashed border-teal-300 bg-gradient-to-br from-teal-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-800">
              <Briefcase className="h-5 w-5" />
              Станьте партнёром {getSiteDisplayName()}
            </CardTitle>
            <CardDescription>
              Сдавайте свою недвижимость и получайте доход. Присоединяйтесь к нашей сети владельцев на Пхукете.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div>
                <div className="text-2xl font-bold text-teal-600">0%</div>
                <div className="text-xs text-slate-500">Комиссия первый месяц</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-600">24/7</div>
                <div className="text-xs text-slate-500">Поддержка</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-600">฿</div>
                <div className="text-xs text-slate-500">Быстрые выплаты</div>
              </div>
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={onOpenPartnerModal}>
              Подать заявку
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {isPendingPartner && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-amber-800">Заявка на рассмотрении</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Мы проверяем вашу заявку на партнёрство. Обычно это занимает до 24 часов. Вы получите уведомление
                  по email.
                </p>
                {pendingNeedsKyc && (
                  <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
                    <p className="text-sm font-medium text-amber-900">Документ не найден в заявке</p>
                    <p className="text-xs text-amber-800">
                      Загрузите паспорт или ID — так мы быстрее сможем вас проверить.
                    </p>
                    <KycUploader
                      value={pendingInlineKycUrl}
                      onChange={onPendingKycUrlChange}
                      disabled={savingPendingKyc}
                      strings={PENDING_KYC_LABELS}
                      onUploadError={(msg) => toast({ title: 'Ошибка загрузки', description: msg, variant: 'destructive' })}
                      onUploadSuccess={() => toast({ title: 'Файл загружен', description: 'Нажмите «Сохранить к заявке»' })}
                    />
                    <Button
                      type="button"
                      className="w-full bg-amber-700 hover:bg-amber-800"
                      disabled={savingPendingKyc || !String(pendingInlineKycUrl || '').trim()}
                      onClick={onSavePendingKyc}
                    >
                      {savingPendingKyc ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Сохранение…
                        </>
                      ) : (
                        'Сохранить документ к заявке'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isRejectedPartner && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Заявка отклонена</h3>
                <p className="text-sm text-red-700 mt-1">{rejectionReason}</p>
                <Button onClick={onRetryPartner} className="mt-3 bg-red-600 hover:bg-red-700" size="sm">
                  Подать заявку повторно
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
