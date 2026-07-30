'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

export function OrderCardAdminActions({ conversationId, bookingId, language }) {
  const chatHref = conversationId ? `/messages/${encodeURIComponent(conversationId)}` : null
  const checkoutHref = bookingId ? `/checkout/${encodeURIComponent(bookingId)}` : null

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {chatHref ? (
        <Button
          asChild
          variant="outline"
          className="border-brand/25 text-brand-hover hover:bg-brand/10 touch-manipulation active:scale-[0.99]"
        >
          <Link href={chatHref} onClick={() => dispatchOptimisticNavPending(chatHref)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            {getUIText('bookingCard_openChat', language)}
          </Link>
        </Button>
      ) : null}
      {checkoutHref ? (
        <Button asChild variant="outline" className="touch-manipulation active:scale-[0.99]">
          <Link href={checkoutHref} onClick={() => dispatchOptimisticNavPending(checkoutHref)}>
            {getUIText('orderAction_details', language)}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
