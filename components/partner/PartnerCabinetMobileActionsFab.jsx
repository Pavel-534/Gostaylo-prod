'use client'

/**
 * Stage 201.60 — partner cabinet notification FAB (PDP/wizard pattern).
 * Replaces WORKSPACE_MOBILE_TOOLBAR breadcrumb + bell strip.
 */

import { PartnerNotificationFeed } from '@/components/partner/PartnerNotificationFeed'
import {
  MOBILE_ACTION_FAB_BUTTON_CLASS,
  MOBILE_ACTION_FAB_STACK_CLASS,
  MOBILE_ACTION_FAB_TOP_UNDER_HEADER,
} from '@/lib/layout/mobile-action-fab'
import { cn } from '@/lib/utils'

export function PartnerCabinetMobileActionsFab({ language = 'ru' }) {
  return (
    <div
      className={cn(MOBILE_ACTION_FAB_STACK_CLASS, 'lg:hidden')}
      style={{ top: MOBILE_ACTION_FAB_TOP_UNDER_HEADER }}
      data-testid="partner-cabinet-actions-fab"
    >
      <PartnerNotificationFeed
        language={language}
        className={cn(MOBILE_ACTION_FAB_BUTTON_CLASS, 'px-0')}
      />
    </div>
  )
}
