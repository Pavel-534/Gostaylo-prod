'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { getUIText } from '@/lib/translations'

export function OrderCardAdminActions({ conversationId, bookingId, language }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {conversationId ? (
        <Button asChild variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50">
          <Link href={`/messages/${encodeURIComponent(conversationId)}`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            {getUIText('bookingCard_openChat', language)}
          </Link>
        </Button>
      ) : null}
      {bookingId ? (
        <Button asChild variant="outline">
          <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>{getUIText('orderAction_details', language)}</Link>
        </Button>
      ) : null}
    </div>
  )
}
