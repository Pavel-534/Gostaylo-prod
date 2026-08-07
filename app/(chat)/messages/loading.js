/**
 * Stage 200.13 / 200.56 — inbox hall skeleton for /messages (thread has its own loading.js).
 */
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_SHELL_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

export default function MessagesHallLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-brand-surface"
      aria-busy="true"
      aria-label="Загрузка сообщений"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-2 overflow-hidden max-sm:p-0 sm:px-4 sm:py-2">
        <div className="gsl-shimmer h-10 w-full max-w-sm rounded-2xl max-sm:mx-3 max-sm:mt-2" />
        <div
          className={cn(
            MOBILE_FLAT_SHELL_CARD_CLASS,
            'flex min-h-0 flex-1 flex-col overflow-hidden',
          )}
        >
          <div className="space-y-1 border-b border-slate-100 px-4 py-3">
            <div className="gsl-shimmer h-5 w-36 rounded-lg" />
            <div className="gsl-shimmer h-3 w-24 rounded-lg" />
          </div>
          <div className="space-y-3 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <div className="gsl-shimmer h-11 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="gsl-shimmer h-3.5 w-2/3 rounded-lg" />
                  <div className="gsl-shimmer h-3 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
