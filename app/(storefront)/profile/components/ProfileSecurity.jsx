'use client'

import { Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getSiteDisplayName } from '@/lib/site-url'
import { AccountConnections } from '@/components/profile/AccountConnections'

/**
 * Stage 189.3 — security tip + AccountConnections (Telegram dual-mode lives in connections SSOT).
 */
export function ProfileSecurity() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <AccountConnections />

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-slate-700">Безопасность</h3>
              <p className="mt-1 text-xs text-slate-500">
                Всегда оплачивайте через {getSiteDisplayName()} для защиты ваших средств. Не переводите деньги
                напрямую незнакомым лицам.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
