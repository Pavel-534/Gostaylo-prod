'use client'

import { User, Mail, Building2, Clock, Briefcase, Phone, ArrowRight, Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KycUploader } from '@/components/kyc-uploader'
import { getSiteDisplayName } from '@/lib/site-url'
import { getUIText } from '@/lib/translations'
import { useCurrency } from '@/contexts/currency-context'
import { getCurrencySymbol } from '@/lib/currency'

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
  onOpenPartnerDashboard,
  partnerNavBusy,
  partnerNavLanguage = 'ru',
}) {
  const { currency } = useCurrency()
  const payoutSymbol = getCurrencySymbol(currency)
  const displayName = user.first_name || user.name || user.email?.split('@')[0] || '—'

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/10 sm:h-16 sm:w-16">
              <User className="h-7 w-7 text-brand sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg">{displayName}</CardTitle>
              <CardDescription className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user.email}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              className={
                isPartner
                  ? 'bg-brand/10 text-brand'
                  : isPendingPartner
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
              }
            >
              {isPartner ? (
                <>
                  <Building2 className="mr-1 h-3 w-3" /> Партнёр
                </>
              ) : isPendingPartner ? (
                <>
                  <Clock className="mr-1 h-3 w-3" /> Заявка на рассмотрении
                </>
              ) : (
                <>
                  <User className="mr-1 h-3 w-3" /> Арендатор
                </>
              )}
            </Badge>
            {user.phone ? (
              <Badge variant="outline" className="max-w-full gap-1">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{user.phone}</span>
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isPartner ? (
        <Card className="mb-6 border-brand/20 bg-gradient-to-br from-brand/5 to-white">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 min-[375px]:flex-row min-[375px]:items-center min-[375px]:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Briefcase className="h-5 w-5 text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">Панель партнёра</p>
                  <p className="text-sm text-slate-500">Управляйте объявлениями и бронированиями</p>
                </div>
              </div>
              <Button
                variant="brand"
                className="h-12 w-full shrink-0 min-[375px]:w-auto min-[375px]:min-w-[7.5rem]"
                disabled={partnerNavBusy}
                onClick={() => onOpenPartnerDashboard?.()}
              >
                {partnerNavBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {getUIText('profile_partnerNavOpening', partnerNavLanguage)}
                  </>
                ) : (
                  'Открыть'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isRenter ? (
        <Card className="mb-6 border-2 border-dashed border-brand/30 bg-gradient-to-br from-brand/5 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-navy">
              <Briefcase className="h-5 w-5 shrink-0 text-brand" />
              <span className="min-w-0">Станьте партнёром {getSiteDisplayName()}</span>
            </CardTitle>
            <CardDescription>
              Сдавайте свою недвижимость и получайте доход. Присоединяйтесь к нашей сети владельцев на Пхукете.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-3 gap-2 text-center min-[375px]:gap-4">
              <div className="min-w-0">
                <div className="text-xl font-bold text-brand min-[375px]:text-2xl">0%</div>
                <div className="text-[10px] text-slate-500 min-[375px]:text-xs">Комиссия первый месяц</div>
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold text-brand min-[375px]:text-2xl">24/7</div>
                <div className="text-[10px] text-slate-500 min-[375px]:text-xs">Поддержка</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-brand min-[375px]:text-2xl">{payoutSymbol}</div>
                <div className="text-[10px] text-slate-500 min-[375px]:text-xs">Быстрые выплаты</div>
              </div>
            </div>
            <Button variant="brand" className="h-12 w-full" onClick={onOpenPartnerModal}>
              Подать заявку
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isPendingPartner ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-amber-800">Заявка на рассмотрении</h3>
                <p className="mt-1 text-sm text-amber-700">
                  Мы проверяем вашу заявку на партнёрство. Обычно это занимает до 24 часов. Вы получите уведомление
                  по email.
                </p>
                {pendingNeedsKyc ? (
                  <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
                    <p className="text-sm font-medium text-amber-900">Документ не найден в заявке</p>
                    <p className="text-xs text-amber-800">
                      Загрузите паспорт или ID — так мы быстрее сможем вас проверить.
                    </p>
                    <KycUploader
                      value={pendingInlineKycUrl}
                      onChange={onPendingKycUrlChange}
                      disabled={savingPendingKyc}
                      strings={PENDING_KYC_LABELS}
                      onUploadError={(msg) =>
                        toast({ title: 'Ошибка загрузки', description: msg, variant: 'destructive' })
                      }
                      onUploadSuccess={() =>
                        toast({ title: 'Файл загружен', description: 'Нажмите «Сохранить к заявке»' })
                      }
                    />
                    <Button
                      type="button"
                      variant="brand"
                      className="h-12 w-full"
                      disabled={savingPendingKyc || !String(pendingInlineKycUrl || '').trim()}
                      onClick={onSavePendingKyc}
                    >
                      {savingPendingKyc ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Сохранение…
                        </>
                      ) : (
                        'Сохранить документ к заявке'
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isRejectedPartner ? (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-red-800">Заявка отклонена</h3>
                <p className="mt-1 break-words text-sm text-red-700">{rejectionReason}</p>
                <Button onClick={onRetryPartner} variant="brand" className="mt-3 h-12" size="sm">
                  Подать заявку повторно
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
