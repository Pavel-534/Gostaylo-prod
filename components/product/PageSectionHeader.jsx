'use client'

import { cn } from '@/lib/utils'
import { GSL_SECTION_SUBTITLE, GSL_SECTION_TITLE } from '@/lib/theme/product-ui'

/**
 * @param {{ title: string, subtitle?: string, action?: React.ReactNode, className?: string, titleClassName?: string }} props
 */
export function PageSectionHeader({ title, subtitle, action, className, titleClassName }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3', className)}>
      <div className="space-y-1.5 min-w-0">
        <h1 className={cn(GSL_SECTION_TITLE, titleClassName)}>{title}</h1>
        {subtitle ? <p className={GSL_SECTION_SUBTITLE}>{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
