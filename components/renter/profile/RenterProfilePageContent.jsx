/**
 * GoStayLo - Renter Profile Page (Phase 2)
 * 
 * Features:
 * - User info with profile completion progress
 * - "Become a Partner" card with controlled application
 * - Telegram connection status
 * - "Welcome Partner" celebration modal
 * - Quick actions & navigation
 * 
 * @version 2.0
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  Mail, Phone, Calendar,
  Home, Heart, Settings, LogOut,
  Send, Shield, TrendingUp, Clock, Zap,
  CheckCircle, XCircle, Loader2, Gift,
  Sparkles, Circle
} from 'lucide-react'
import { format } from 'date-fns'
import { getUIText } from '@/lib/translations'
import { telegramAccountLinkUrl } from '@/lib/telegram-bot-public'
import { resolveAvatarDisplaySrc } from '@/lib/image-display-url'
import { KycUploader } from '@/components/kyc-uploader'
import { PartnerApplicationModal } from '@/components/renter/PartnerApplicationModal'
import { useRenterProfilePage } from '@/hooks/renter/use-renter-profile-page'
import { roleUiKey } from '@/lib/renter/profile-completion'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'

export default function RenterProfilePageContent() {
  const {
    language,
    user,
    loading,
    applicationStatus,
    loadingApplication,
    telegramLinked,
    showApplicationModal,
    setShowApplicationModal,
    submittingApplication,
    pendingKycUrl,
    setPendingKycUrl,
    savingPendingKyc,
    dateLocale,
    handleApplicationSubmit,
    handleSavePendingKyc,
    handleLogout,
    profileCompletion,
    profileItems,
  } = useRenterProfilePage()

  if (loading) {
    return <LoadingPageShell variant="inline" label={getUIText('loading', language)} />
  }
  
  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">{getUIText('renterProfileLoginPrompt', language)}</p>
        <Button asChild variant="brand">
          <Link href="/profile?login=true">{getUIText('renterProfileLogIn', language)}</Link>
        </Button>
      </div>
    )
  }

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.name ||
    getUIText('guest', language)
  const initialLetter =
    (user.first_name?.charAt(0) || user.last_name?.charAt(0) || user.name?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()
  
  return (
    <div className="space-y-6">
      {/* Header with User Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Avatar className="w-24 h-24 border border-slate-200">
              {user.avatar ? (
                <AvatarImage
                  src={resolveAvatarDisplaySrc(user.avatar) || ''}
                  alt=""
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-hover text-white text-3xl font-bold">
                {initialLetter}
              </AvatarFallback>
            </Avatar>
            
            {/* User Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {displayName}
                </h1>
                <Badge className={
                  user.role === 'PARTNER' 
                    ? 'bg-brand/15 text-brand-hover border-brand/30'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }>
                  {getUIText(roleUiKey(user.role), language)}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  {user.email}
                </div>
                {user.phone && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    {user.phone}
                  </div>
                )}
                {user.created_at && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {getUIText('memberSince', language)} {format(new Date(user.created_at), 'MMM yyyy', { locale: dateLocale })}
                  </div>
                )}
                <p className="text-xs text-slate-500 pt-1 max-w-md mx-auto sm:mx-0">
                  {getUIText('renterProfilePrivacyHint', language)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Profile Completion */}
          <Separator className="my-6" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{getUIText('profileCompletion', language)}</span>
              <span className="text-sm font-semibold text-brand">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
            <p className="text-xs text-slate-500 mt-2">
              {profileCompletion < 100 
                ? getUIText('completeProfileToUnlock', language)
                : getUIText('profileComplete', language)}
            </p>
            {profileCompletion < 100 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  {getUIText('profileCompletionChecklist', language)}
                </p>
                <ul className="space-y-2">
                  {profileItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-sm">
                      {item.done ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-slate-300 mt-0.5" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={item.done ? 'text-slate-600' : 'text-slate-900 font-medium'}>
                          {getUIText(item.labelKey, language)}
                        </span>
                        {!item.done && item.settingsHref && (
                          <div className="mt-0.5">
                            <Link
                              href={item.settingsHref}
                              className="text-xs font-medium text-brand hover:text-brand-hover underline-offset-2 hover:underline"
                            >
                              {getUIText('profileItemAddInSettings', language)}
                            </Link>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Become a Partner Card (Only for non-partners) */}
      {user.role !== 'PARTNER' && (
        <Card className="border-2 border-brand/25 bg-gradient-to-br from-brand/10 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand">
              <Sparkles className="h-6 w-6" />
              {getUIText('startEarning', language)}
            </CardTitle>
            <CardDescription className="text-brand-hover">
              {getUIText('listYourProperty', language)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-brand/20">
                <div className="w-10 h-10 bg-brand/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{getUIText('commissionZero', language)}</p>
                  <p className="text-xs text-slate-600">{getUIText('keepAllEarnings', language)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-brand/20">
                <div className="w-10 h-10 bg-brand/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{getUIText('support247', language)}</p>
                  <p className="text-xs text-slate-600">{getUIText('alwaysHere', language)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-brand/20">
                <div className="w-10 h-10 bg-brand/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{getUIText('fastPayouts', language)}</p>
                  <p className="text-xs text-slate-600">{getUIText('quickPayments', language)}</p>
                </div>
              </div>
            </div>
            
            {/* Application Status or CTA — без «пустого» спиннера: стабильная высота, нет мерцания */}
            {loadingApplication && !applicationStatus ? (
              <Button
                type="button"
                disabled
                className="bg-brand/80 text-lg py-6 cursor-wait opacity-90"
              >
                <Loader2 className="h-5 w-5 mr-2 animate-spin shrink-0" />
                {getUIText('partnerAppStatusLoading', language)}
              </Button>
            ) : applicationStatus ? (
              <div className={`p-4 rounded-lg border-2 ${
                applicationStatus.status === 'PENDING'
                  ? 'bg-amber-50 border-amber-200'
                  : applicationStatus.status === 'APPROVED'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {applicationStatus.status === 'PENDING' && (
                      <>
                        <Clock className="h-6 w-6 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-amber-900">{getUIText('renterApplicationPendingTitle', language)}</p>
                          <p className="text-sm text-amber-700">{getUIText('renterApplicationPendingDesc', language)}</p>
                          {applicationStatus.hasVerificationDoc !== true && (
                            <div className="mt-4 pt-4 border-t border-amber-200/80 space-y-3 text-left">
                              <p className="text-sm font-medium text-amber-900">
                                {getUIText('partnerPendingKycAttachTitle', language)}
                              </p>
                              <p className="text-xs text-amber-800/90">
                                {getUIText('partnerPendingKycAttachDesc', language)}
                              </p>
                              <KycUploader
                                value={pendingKycUrl}
                                onChange={setPendingKycUrl}
                                disabled={savingPendingKyc}
                                strings={{
                                  label: getUIText('partnerKycLabel', language),
                                  requiredBadge: '*',
                                  uploading: getUIText('partnerKycUploading', language),
                                  uploaded: getUIText('partnerKycUploaded', language),
                                  remove: getUIText('partnerKycRemove', language),
                                  tapToUpload: getUIText('partnerKycTapToUpload', language),
                                  fileTypesHint: getUIText('partnerKycFileTypesHint', language),
                                  privacyHint: getUIText('partnerKycPrivacyHint', language),
                                  errorTooLarge: getUIText('partnerKycErrorTooLarge', language),
                                  errorUploadFailed: getUIText('partnerKycErrorUpload', language),
                                }}
                                onUploadError={(msg) => toast.error(msg)}
                                onUploadSuccess={() =>
                                  toast.success(getUIText('partnerKycUploadSuccess', language))
                                }
                              />
                              <Button
                                type="button"
                                className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                                disabled={savingPendingKyc || !String(pendingKycUrl || '').trim()}
                                onClick={() => void handleSavePendingKyc()}
                              >
                                {savingPendingKyc ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" />
                                    {getUIText('partnerPendingKycSaving', language)}
                                  </>
                                ) : (
                                  getUIText('partnerPendingKycSave', language)
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {applicationStatus.status === 'APPROVED' && (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">{getUIText('renterApplicationApprovedTitle', language)}</p>
                          <p className="text-sm text-green-700">{getUIText('renterApplicationApprovedDesc', language)}</p>
                        </div>
                      </>
                    )}
                    {applicationStatus.status === 'REJECTED' && (
                      <>
                        <XCircle className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">{getUIText('applicationDeclined', language)}</p>
                          {applicationStatus.rejection_reason && (
                            <p className="text-sm text-red-700">{applicationStatus.rejection_reason}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {applicationStatus.status === 'APPROVED' && (
                    <Button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700">
                      {getUIText('renterApplicationRefresh', language)}
                    </Button>
                  )}
                  
                  {applicationStatus.status === 'REJECTED' && (
                    <Button onClick={() => setShowApplicationModal(true)} variant="outline">
                      {getUIText('reapply', language)}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowApplicationModal(true)}
                variant="brand"
                className="w-full text-lg py-6"
              >
                <Send className="h-5 w-5 mr-2" />
                {getUIText('applyBecomePartner', language)}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Connect Telegram */}
      <Card id="telegram-connect" className="scroll-mt-24 md:scroll-mt-8">
        <CardHeader>
          <CardTitle className="text-lg">{getUIText('telegramNotifications', language)}</CardTitle>
          <CardDescription>
            {getUIText('instantUpdates', language)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {telegramLinked ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">{getUIText('renterTelegramConnectedTitle', language)}</p>
                <p className="text-sm text-green-700">
                  {user.telegram_username
                    ? `@${String(user.telegram_username).replace(/^@/, '')}`
                    : getUIText('renterTelegramConnectedNoUsername', language)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{getUIText('telegramLinkOneTapHint', language)}</p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!user?.id}
                onClick={() => {
                  if (!user?.id) return
                  window.open(telegramAccountLinkUrl(user.id), '_blank', 'noopener,noreferrer')
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {getUIText('telegramLinkOneTap', language)}
              </Button>
              <p className="text-xs text-slate-500">{getUIText('telegramLinkAltEmail', language)}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{getUIText('quickActions', language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/renter/bookings">
                <Home className="h-6 w-6 mb-2" />
                <span className="text-sm">{getUIText('bookings', language)}</span>
              </Link>
            </Button>
            
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/renter/favorites">
                <Heart className="h-6 w-6 mb-2" />
                <span className="text-sm">{getUIText('favorites', language)}</span>
              </Link>
            </Button>
            
            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/profile/referral">
                <Gift className="h-6 w-6 mb-2" />
                <span className="text-sm">Рефералка</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="flex flex-col h-auto py-4"
            >
              <Link href="/renter/settings">
                <Settings className="h-6 w-6 mb-2" />
                <span className="text-sm">{getUIText('settings', language)}</span>
              </Link>
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex flex-col h-auto py-4 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-6 w-6 mb-2" />
              <span className="text-sm">{getUIText('logout', language)}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Modals */}
      <PartnerApplicationModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        onSubmit={handleApplicationSubmit}
        isSubmitting={submittingApplication}
      />
    </div>
  )
}
