'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru, enUS, zhCN } from 'date-fns/locale'
import { th as thLocale } from 'date-fns/locale/th'
import { ArrowLeft, CheckCircle2, Loader2, MessageSquare, ShieldCheck, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { persistPendingReferralFromLanding } from '@/lib/referral/persist-pending-ref-client'
import { ReviewPhotosGallery } from '@/components/review-photos-gallery'
import { PartnerTrustBadge } from '@/components/trust/PartnerTrustBadge'
import { toast } from 'sonner'

const DATE_LOCALES = { ru, en: enUS, zh: zhCN, th: thLocale }

export default function PublicUserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id != null ? String(params.id) : ''
  const { language } = useI18n()
  const { user: currentUser, openLoginModal, refreshUserFromServer } = useAuth()
  const [profile, setProfile] = useState(null)
  const [landingMeta, setLandingMeta] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewsBusy, setReviewsBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const dateLocale = DATE_LOCALES[language] || (language === 'ru' ? ru : enUS)
  const t = (key, ctx) => getUIText(key, language, ctx)

  useEffect(() => {
    const code = landingMeta?.referralCode
    if (!code) return
    persistPendingReferralFromLanding(code)
  }, [landingMeta?.referralCode])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const [pr, metaRes] = await Promise.all([
        fetch(`/api/v2/profiles/${encodeURIComponent(id)}/public`),
        fetch(`/api/v2/referral/landing-meta/${encodeURIComponent(id)}`).catch(() => null),
      ])
      const pj = await pr.json()
      let metaPayload = null
      if (metaRes && metaRes.ok) {
        const mj = await metaRes.json().catch(() => ({}))
        if (mj?.success && mj?.data) metaPayload = mj.data
      }

      if (!pr.ok || !pj.success || !pj.profile) {
        setNotFound(true)
        setProfile(null)
        setLandingMeta(null)
        setReviews([])
        return
      }
      setProfile(pj.profile)
      setLandingMeta(metaPayload)

      setReviews([])
      void (async () => {
        try {
          setReviewsBusy(true)
          const role = String(pj.profile.role || '').toUpperCase()
          const qs =
            role === 'PARTNER'
              ? `partner_id=${encodeURIComponent(id)}`
              : `reviewer_id=${encodeURIComponent(id)}`
          const rr = await fetch(`/api/v2/reviews?${qs}`)
          const rj = await rr.json()
          const list =
            rj.success && rj.data?.reviews && Array.isArray(rj.data.reviews) ? rj.data.reviews : []
          setReviews(list)
        } catch {
          setReviews([])
        } finally {
          setReviewsBusy(false)
        }
      })()
    } catch (e) {
      console.error('[public profile]', e)
      toast.error(getUIText('publicProfileLoadError', language))
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id, language])

  useEffect(() => {
    void load()
  }, [load])

  async function handleMessage() {
    if (!currentUser?.id) {
      openLoginModal('login')
      return
    }
    if (String(currentUser.id) === id) return
    setChatLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations/from-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId: id, language }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        const msg = data.errorKey ? getUIText(data.errorKey, language) : data.error || 'Error'
        toast.error(msg)
        return
      }
      const convId = data.data?.id
      if (convId) {
        await refreshUserFromServer?.()
        router.push(`/messages/${encodeURIComponent(convId)}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(getUIText('publicProfileChatUnavailable', language))
    } finally {
      setChatLoading(false)
    }
  }

  const isSelf =
    !!currentUser?.id &&
    !!id &&
    String(currentUser?.id)?.toLowerCase() === String(id).toLowerCase()

  const displayNameHero = profile?.displayName || landingMeta?.displayName || '—'

  const badgeLine = String(
    landingMeta?.badgeLabel ||
      landingMeta?.tierLabel ||
      (landingMeta?.referralCode ? 'Ambassador' : ''),
  ).trim()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center bg-background px-4 text-foreground">
        <p className="text-muted-foreground mb-4">{getUIText('publicProfileNotFound', language)}</p>
        <Button asChild variant="outline">
          <Link href="/">{getUIText('publicProfileBack', language)}</Link>
        </Button>
      </div>
    )
  }

  const initial =
    (profile.displayName?.charAt(0) || profile.firstName?.charAt(0) || '?').toUpperCase()
  const memberDate =
    profile.createdAt && !Number.isNaN(new Date(profile.createdAt).getTime())
      ? format(new Date(profile.createdAt), 'LLLL yyyy', { locale: dateLocale })
      : null

  const reviewsTitle =
    String(profile.role).toUpperCase() === 'PARTNER'
      ? getUIText('publicProfileReviewsAsHost', language)
      : getUIText('publicProfileReviewsAsGuest', language)

  const showMessageCta =
    currentUser?.id && String(currentUser.id) !== id ? true : !currentUser?.id

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <div className="border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-3xl flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/listings" aria-label={getUIText('publicProfileBack', language)}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold truncate">{displayNameHero}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <Card className="border-border shadow-sm bg-card overflow-hidden">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <Avatar className="h-28 w-28 shrink-0 border border-border">
                {profile.avatar ? (
                  <AvatarImage src={profile.avatar} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground text-3xl font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3 min-w-0">
                <h2 className="text-2xl font-bold tracking-tight">{displayNameHero}</h2>
                {memberDate ? (
                  <p className="text-sm text-muted-foreground">
                    {getUIText('publicProfileMemberSince', language)} {memberDate}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {profile.isVerified ? (
                    <Badge className="gap-1 bg-primary/15 text-primary border-primary/25 font-normal">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {getUIText('publicProfileVerified', language)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal text-muted-foreground">
                      {getUIText('publicProfileNotVerified', language)}
                    </Badge>
                  )}
                  {badgeLine ? (
                    <Badge
                      variant="outline"
                      className="font-medium border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                    >
                      {badgeLine}
                    </Badge>
                  ) : null}
                </div>
                {String(profile.role || '').toUpperCase() === 'PARTNER' && profile.partnerTrust ? (
                  <PartnerTrustBadge trust={profile.partnerTrust} language={language} />
                ) : null}
                {!isSelf ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-left mt-4">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {t('stage74_3_teamInviteLine')}
                    </p>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2 flex-wrap">
                      <Button
                        type="button"
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() =>
                          currentUser?.id ? router.push('/') : openLoginModal('register')
                        }
                      >
                        {currentUser?.id ? t('stage74_3_continueApp') : t('stage74_3_register')}
                      </Button>
                      {!currentUser?.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto border-border"
                          onClick={() => openLoginModal('login')}
                        >
                          {t('stage74_3_login')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('stage74_3_whyTitle')}
                  </p>
                  <ul className="space-y-1.5 text-sm text-foreground/90">
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{t('stage74_3_whyRent')}</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{t('stage74_3_whyEarn')}</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{t('stage74_3_whyBonus')}</span>
                    </li>
                  </ul>
                </div>
                {showMessageCta ? (
                  <div className="pt-3">
                    <Button
                      variant="secondary"
                      className="border border-border bg-secondary/80"
                      disabled={chatLoading}
                      onClick={currentUser?.id ? handleMessage : () => openLoginModal('login')}
                    >
                      {chatLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-2" />
                      )}
                      {currentUser?.id
                        ? getUIText('publicProfileMessageCta', language)
                        : getUIText('publicProfileLoginToMessage', language)}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold">{reviewsTitle}</h3>
          {reviewsBusy ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('stage74_3_reviewsLoading')}
            </p>
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">{getUIText('publicProfileNoReviews', language)}</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-border bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-medium truncate">
                            {review.reviewerName || review.reviewer_name || '—'}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span className="text-sm">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
                        <ReviewPhotosGallery photos={review.photos} className="mt-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
