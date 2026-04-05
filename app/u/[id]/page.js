'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru, enUS, zhCN } from 'date-fns/locale'
import { th as thLocale } from 'date-fns/locale/th'
import { ArrowLeft, Loader2, MessageSquare, ShieldCheck, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { ReviewPhotosGallery } from '@/components/review-photos-gallery'
import { toast } from 'sonner'

const DATE_LOCALES = { ru, en: enUS, zh: zhCN, th: thLocale }

export default function PublicUserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id != null ? String(params.id) : ''
  const { language } = useI18n()
  const { user: currentUser, openLoginModal, refreshUserFromServer } = useAuth()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const dateLocale = DATE_LOCALES[language] || (language === 'ru' ? ru : enUS)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const pr = await fetch(`/api/v2/profiles/${encodeURIComponent(id)}/public`)
      const pj = await pr.json()
      if (!pr.ok || !pj.success || !pj.profile) {
        setNotFound(true)
        setProfile(null)
        setReviews([])
        return
      }
      setProfile(pj.profile)
      const role = String(pj.profile.role || '').toUpperCase()
      let qs = ''
      if (role === 'PARTNER') {
        qs = `partner_id=${encodeURIComponent(id)}`
      } else {
        qs = `reviewer_id=${encodeURIComponent(id)}`
      }
      const rr = await fetch(`/api/v2/reviews?${qs}`)
      const rj = await rr.json()
      const list =
        rj.success && rj.data?.reviews && Array.isArray(rj.data.reviews) ? rj.data.reviews : []
      setReviews(list)
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-600 mb-4">{getUIText('publicProfileNotFound', language)}</p>
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
    currentUser?.id && String(currentUser.id) !== id
      ? true
      : !currentUser?.id

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 max-w-3xl flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/listings" aria-label={getUIText('publicProfileBack', language)}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-slate-900 truncate">{profile.displayName}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        <Card className="border-slate-200">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <Avatar className="h-28 w-28 border border-slate-200">
                {profile.avatar ? (
                  <AvatarImage src={profile.avatar} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-teal-100 text-teal-800 text-3xl font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <h2 className="text-2xl font-bold text-slate-900">{profile.displayName}</h2>
                {memberDate ? (
                  <p className="text-sm text-slate-600">
                    {getUIText('publicProfileMemberSince', language)} {memberDate}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {profile.isVerified ? (
                    <Badge className="gap-1 bg-teal-50 text-teal-800 border-teal-200 font-normal">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {getUIText('publicProfileVerified', language)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal text-slate-600">
                      {getUIText('publicProfileNotVerified', language)}
                    </Badge>
                  )}
                </div>
                {showMessageCta ? (
                  <div className="pt-2">
                    <Button
                      className="bg-teal-600 hover:bg-teal-700"
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

        <section>
          <h3 className="text-xl font-semibold text-slate-900 mb-4">{reviewsTitle}</h3>
          {reviews.length === 0 ? (
            <p className="text-slate-500 text-sm">{getUIText('publicProfileNoReviews', language)}</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-teal-600" />
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
                        <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
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
