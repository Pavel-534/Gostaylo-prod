'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from 'lucide-react'
import { getUIText } from '@/lib/translations'

/**
 * PDP: informational host-messaging hint + last preview (desktop). Primary chat CTA lives in **`BookingWidget`**.
 */
export function ListingChatPreview({
  language,
  listing,
  showContactPartner,
  lastMessagePreview,
  hasUnreadFromHost,
}) {
  if (!showContactPartner) return null

  const slug = listing?.categorySlug || listing?.category?.slug || ''
  const tx = (k) => getUIText(k, language, slug ? { listingCategorySlug: slug } : undefined)
  const hint = tx('listingPdp_chatInfoHint')
  const owner = listing?.owner
  const avatarUrl = owner?.avatar || null
  const initial =
    owner?.first_name && String(owner.first_name).trim()
      ? String(owner.first_name).trim().slice(0, 1).toUpperCase()
      : '?'

  return (
    <Card className="hidden lg:block border-teal-100 bg-gradient-to-br from-teal-50/80 to-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-4 items-start">
          <Avatar className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 border border-teal-100">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-teal-100 text-teal-800 text-sm font-semibold">
              {initial !== '?' ? (
                initial
              ) : (
                <User className="h-5 w-5 text-teal-700" aria-hidden />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{hint}</p>
            {lastMessagePreview ? (
              <p
                className={`text-xs leading-snug line-clamp-2 ${
                  hasUnreadFromHost ? 'text-amber-900 font-medium' : 'text-slate-600'
                }`}
              >
                {hasUnreadFromHost ? `${language === 'ru' ? 'Новое: ' : 'New: '}` : ''}
                {lastMessagePreview}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
