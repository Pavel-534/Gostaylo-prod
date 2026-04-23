'use client'

import { MessageSquare, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { telegramAccountLinkUrl } from '@/lib/telegram-bot-public'

export function ProfileSecurity({ user, onToast }) {
  return (
    <>
      {!user?.telegram_id && (
        <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6 pb-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Оставайтесь на связи!</h3>
              <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
                Привяжите Telegram, чтобы получать уведомления о бронированиях и важных событиях мгновенно.
              </p>
              <Button
                className="bg-blue-600 hover:bg-blue-700 px-6"
                disabled={!user?.id}
                onClick={() => {
                  if (!user?.id) {
                    onToast({
                      title: 'Сначала войдите',
                      description:
                        'Обновите страницу или войдите в аккаунт, затем снова нажмите «Привязать Telegram».',
                      variant: 'destructive',
                    })
                    return
                  }
                  window.open(telegramAccountLinkUrl(user.id), '_blank', 'noopener,noreferrer')
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Привязать Telegram
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-slate-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-slate-700 text-sm">Безопасность</h3>
              <p className="text-xs text-slate-500 mt-1">
                Всегда оплачивайте через GoStayLo для защиты ваших средств. Не переводите деньги напрямую
                незнакомым лицам.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
