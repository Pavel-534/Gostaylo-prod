'use client'

/**
 * Stage 69.0 — двухшаговый выбор категории (вертикаль → подкатегории из `parent_id`).
 * Если у корня нет детей — выбор сразу на шаге А.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { chipIconForCategory } from '@/components/search/category-chip-icon'
import { hasCategoryParent } from '@/lib/config/category-hierarchy'
import { categorySlugMatchesListingServiceType } from '@/lib/partner/listing-service-type'

export function PartnerCategoryPickerTwoStep({
  categories = [],
  listingServiceType,
  categoryId,
  language = 'ru',
  getCategoryDisplayName,
  onSelectCategoryId,
  disabled = false,
}) {
  const [step, setStep] = useState('root')
  const [pickedRootId, setPickedRootId] = useState(null)

  const filtered = useMemo(() => {
    const st = listingServiceType
    if (!st) return []
    return categories.filter((c) =>
      categorySlugMatchesListingServiceType(String(c.slug), st, c.wizardProfile ?? c.wizard_profile),
    )
  }, [categories, listingServiceType])

  const roots = useMemo(
    () =>
      filtered
        .filter((c) => !hasCategoryParent(c))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
    [filtered],
  )

  /** Если все строки — только дочерние (нет корней), показываем весь отфильтрованный список как шаг А */
  const displayRoots = useMemo(() => (roots.length > 0 ? roots : filtered), [roots, filtered])

  const childrenOfRoot = useMemo(() => {
    if (!pickedRootId) return []
    return filtered
      .filter((c) => String(c.parentId ?? c.parent_id ?? '') === String(pickedRootId))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  }, [filtered, pickedRootId])

  useEffect(() => {
    if (!listingServiceType) {
      setStep('root')
      setPickedRootId(null)
      return
    }
    const cat = categories.find((c) => String(c.id) === String(categoryId))
    if (!cat || !categoryId) {
      setStep('root')
      setPickedRootId(null)
      return
    }
    const pid = cat.parentId ?? cat.parent_id
    if (pid) {
      setStep('child')
      setPickedRootId(String(pid))
    } else {
      setStep('root')
      setPickedRootId(null)
    }
  }, [listingServiceType, categoryId, categories, filtered])

  const handleRootClick = (root) => {
    const kids = filtered.filter((c) => String(c.parentId ?? c.parent_id) === String(root.id))
    if (kids.length === 0) {
      onSelectCategoryId(root.id)
      setStep('root')
      setPickedRootId(null)
      return
    }
    setPickedRootId(String(root.id))
    setStep('child')
  }

  const backLabel = language === 'ru' ? 'Назад к разделам' : 'Back to verticals'

  if (!listingServiceType) return null

  return (
    <div className="space-y-3">
      {step === 'child' && pickedRootId ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2 text-teal-700 hover:text-teal-900"
            onClick={() => {
              setStep('root')
              setPickedRootId(null)
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            {childrenOfRoot.map((child) => {
              const Icon = chipIconForCategory(child)
              const selected = String(categoryId) === String(child.id)
              return (
                <button
                  key={child.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCategoryId(child.id)}
                  className={cn(
                    'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-center transition-all',
                    selected
                      ? 'border-teal-600 bg-teal-50 shadow-md ring-2 ring-teal-200'
                      : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm',
                  )}
                >
                  <Icon className="h-8 w-8 text-teal-600" aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">
                    {getCategoryDisplayName(child)}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {displayRoots.map((root) => {
            const Icon = chipIconForCategory(root)
            const selected = String(categoryId) === String(root.id)
            const hasKids = filtered.some((c) => String(c.parentId ?? c.parent_id) === String(root.id))
            return (
              <button
                key={root.id}
                type="button"
                disabled={disabled}
                onClick={() => handleRootClick(root)}
                className={cn(
                  'flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-5 text-center transition-all',
                  selected && !hasKids
                    ? 'border-teal-600 bg-teal-50 shadow-md ring-2 ring-teal-200'
                    : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm',
                )}
              >
                <Icon className="h-10 w-10 text-teal-600" aria-hidden />
                <span className="text-base font-semibold text-slate-900">
                  {getCategoryDisplayName(root)}
                </span>
                {hasKids ? (
                  <span className="text-xs font-medium text-slate-500">
                    {language === 'ru' ? 'Выбрать тип →' : 'Choose type →'}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
