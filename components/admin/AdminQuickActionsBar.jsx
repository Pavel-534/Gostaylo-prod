'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  postFintechPreparePause,
  postFintechSmokeFinancialRun,
  triggerFintechBlobDownload,
} from '@/lib/admin/admin-fintech-api-client'
import { getSiteBrandSlug } from '@/lib/site-url'
import { resolveAdminQuickActions } from '@/lib/admin/admin-menu'

/**
 * @param {{ groupKey: string | null | undefined, role: string | null | undefined, className?: string }} props
 */
export function AdminQuickActionsBar({ groupKey, role, className }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState(null)
  const actions = resolveAdminQuickActions(groupKey, role)

  if (!actions.length) return null

  async function runSmoke() {
    setBusyId('fin-smoke')
    try {
      const { ok, data, json } = await postFintechSmokeFinancialRun({ rail: 'rub' })
      if (!ok) {
        toast.error(json?.error || data?.error || 'Smoke завершился с ошибками')
        return
      }
      toast.success('Financial smoke: успех', {
        description: data?.summary || 'Цепочка escrow → payout проверена.',
      })
    } catch (e) {
      toast.error(e?.message || 'Ошибка smoke')
    } finally {
      setBusyId(null)
    }
  }

  async function runPreparePause() {
    const confirmed = window.confirm(
      'Подготовить систему к паузе? Будет запущен smoke, собран архив и включена пауза новых оплат.',
    )
    if (!confirmed) return
    setBusyId('fin-pause')
    try {
      const { ok, blob, smokeOk, json } = await postFintechPreparePause({})
      if (!ok) {
        toast.error(json?.error || 'Не удалось подготовить к паузе')
        return
      }
      if (blob) {
        triggerFintechBlobDownload(blob, `${getSiteBrandSlug()}-prepare-pause-${Date.now()}.zip`)
      }
      toast.success('Пакет подготовки к паузе скачан', {
        description: smokeOk ? 'Smoke пройден.' : 'В архиве есть ошибки smoke — проверьте отчёт.',
        variant: smokeOk ? 'default' : 'destructive',
      })
    } catch (e) {
      toast.error(e?.message || 'Ошибка prepare-pause')
    } finally {
      setBusyId(null)
    }
  }

  async function onAction(action) {
    if (busyId) return
    switch (action.kind) {
      case 'smoke-financial':
        await runSmoke()
        break
      case 'prepare-pause':
        await runPreparePause()
        break
      case 'router-refresh':
        setBusyId(action.id)
        router.refresh()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin:users-refresh'))
        }
        toast.message('Список обновляется…')
        setTimeout(() => setBusyId(null), 600)
        break
      default:
        break
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {actions.map((action) => {
        const loading = busyId === action.id
        const variant =
          action.variant === 'brand'
            ? 'default'
            : action.variant === 'secondary'
              ? 'secondary'
              : action.variant || 'outline'

        if (action.kind === 'link' && action.href) {
          return (
            <Button key={action.id} asChild size="sm" variant={variant} className={action.variant === 'brand' ? 'bg-brand hover:bg-brand-hover' : ''}>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )
        }

        return (
          <Button
            key={action.id}
            size="sm"
            variant={variant}
            disabled={loading}
            className={action.variant === 'brand' ? 'bg-brand hover:bg-brand-hover' : ''}
            onClick={() => void onAction(action)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}
