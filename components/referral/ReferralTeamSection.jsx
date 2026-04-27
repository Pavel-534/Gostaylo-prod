'use client'

/**
 * Stage 72.6 — «Моя команда»: прямые приглашённые из referral_relations + чат (conversations / from-profile).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, MessageCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ReferralTeamSection({ members = [], t, language = 'ru' }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState(null)

  async function openChat(member) {
    if (member.conversationId) {
      router.push(`/messages/${encodeURIComponent(member.conversationId)}`)
      return
    }
    setBusyId(member.refereeId)
    try {
      const res = await fetch('/api/v2/chat/conversations/from-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: member.refereeId, language }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.data?.id) {
        router.push(`/messages/${encodeURIComponent(json.data.id)}`)
        return
      }
      const errKey = json?.errorKey
      const msg =
        errKey === 'publicProfileChatNoListing'
          ? t('referralStage726_chatNoListing')
          : errKey === 'publicProfileChatUnavailable'
            ? t('referralStage726_chatUnavailable')
            : json?.error || t('referralStage726_writeError')
      toast.error(msg)
    } catch {
      toast.error(t('referralStage726_writeError'))
    } finally {
      setBusyId(null)
    }
  }

  function roleLabel(role) {
    const r = String(role || '').toUpperCase()
    if (r === 'PARTNER') return t('uiRolePARTNER')
    if (r === 'RENTER') return t('uiRoleRENTER')
    return t('uiRoleUSER')
  }

  function statusLabel(status) {
    return status === 'active' ? t('referralStage726_statusActive') : t('referralStage726_statusPending')
  }

  return (
    <Card className="border border-teal-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-teal-700" />
          {t('referralStage726_teamTitle')}
        </CardTitle>
        <CardDescription>{t('referralStage726_teamDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!members.length ? (
          <p className="text-sm text-slate-600 py-2">{t('referralStage726_teamEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
            {members.map((m) => (
              <li key={m.refereeId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-slate-50/50 hover:bg-slate-50">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-slate-900 truncate">{m.displayName}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="secondary" className="font-normal">
                      {roleLabel(m.role)}
                    </Badge>
                    <Badge
                      variant={m.activityStatus === 'active' ? 'default' : 'outline'}
                      className={
                        m.activityStatus === 'active'
                          ? 'bg-emerald-600 hover:bg-emerald-600 font-normal'
                          : 'font-normal text-amber-900 border-amber-300'
                      }
                    >
                      {statusLabel(m.activityStatus)}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 relative"
                  disabled={busyId === m.refereeId}
                  onClick={() => void openChat(m)}
                >
                  {busyId === m.refereeId ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <span className="relative inline-flex mr-1">
                      <MessageCircle className="h-4 w-4" />
                      {(m.chatUnreadCount || 0) > 0 ? (
                        <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                          {(m.chatUnreadCount || 0) > 99 ? '99+' : String(m.chatUnreadCount)}
                        </span>
                      ) : null}
                    </span>
                  )}
                  {t('referralStage726_write')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
