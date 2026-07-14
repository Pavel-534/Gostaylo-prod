'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PartnerFinancesPillSubNav } from '@/components/partner/finances/PartnerFinancesPillSubNav'
import { PartnerHealthWidget } from '@/components/trust/PartnerHealthWidget'
import { SuccessGuide } from '@/components/partner/SuccessGuide'
import { usePartnerReputationHealthQuery } from '@/hooks/use-partner-reputation-health'
import { getUIText } from '@/lib/translations'
import { useIsMobile } from '@/hooks/use-mobile'

const HELP_TABS = [
  { id: 'health', labelKey: 'partnerDashboard_successHelpTabHealth' },
  { id: 'top', labelKey: 'partnerDashboard_successHelpTabTop' },
]

function useVisualViewportMaxHeight(fallback = '92dvh') {
  const [maxHeight, setMaxHeight] = useState(fallback)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setMaxHeight(`${window.visualViewport.height}px`)
      }
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    return () => window.visualViewport?.removeEventListener('resize', update)
  }, [])

  return maxHeight
}

/**
 * Education drawer: reliability + TOP guide (Stage 187.0).
 */
export function PartnerSuccessHelpDrawer({ open, onOpenChange, language = 'ru', initialTab = 'health' }) {
  const isMobile = useIsMobile()
  const side = isMobile ? 'bottom' : 'right'
  const viewportHeight = useVisualViewportMaxHeight()
  const [activeTab, setActiveTab] = useState(initialTab)
  const q = usePartnerReputationHealthQuery(open)

  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  const tabs = HELP_TABS.map(({ id, labelKey }) => ({
    id,
    label: getUIText(labelKey, language),
  }))

  const effError = q.isError ? String(q.error?.message || 'load_failed') : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        style={side === 'bottom' ? { maxHeight: viewportHeight } : undefined}
        className={
          side === 'bottom'
            ? 'z-[210] flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-slate-200 p-0 sm:max-w-lg'
            : 'z-[210] flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl'
        }
      >
        <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-5 sm:px-6">
          <SheetHeader className="space-y-0 p-0 text-left">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              {getUIText('partnerDashboard_successHelpTitle', language)}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3">
            <PartnerFinancesPillSubNav
              ariaLabel={getUIText('partnerDashboard_successHelpDrawerAria', language)}
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              className="mb-0"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
          {activeTab === 'health' ? (
            <PartnerHealthWidget
              language={language}
              remote={{
                data: q.data ?? null,
                loading: q.isPending,
                error: effError,
                reload: () => void q.refetch(),
              }}
            />
          ) : (
            <SuccessGuide
              language={language}
              snapshot={q.data?.snapshot ?? null}
              dominantCategorySlug={q.data?.dominantCategorySlug ?? null}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
