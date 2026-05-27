'use client'

import { cn } from '@/lib/utils'
import {
  formatSignedAmountThb,
  signedAmountCellClass,
  signedAmountToneClass,
} from '@/lib/admin/format-signed-thb'

/**
 * Единый вывод суммы в таблицах админки (font-mono, +/- цвет).
 * @param {{
 *   value: unknown
 *   currency?: string
 *   showPlus?: boolean
 *   className?: string
 *   as?: 'td' | 'span'
 * }} props
 */
export function AdminTableAmount({
  value,
  currency = 'THB',
  showPlus = true,
  className,
  as: Tag = 'span',
}) {
  const cellClass =
    Tag === 'td'
      ? cn(signedAmountCellClass(value), className)
      : cn('font-mono tabular-nums font-medium', signedAmountToneClass(value), className)

  return (
    <Tag className={cellClass}>
      {formatSignedAmountThb(value, { currency, showPlus })}
    </Tag>
  )
}
