'use client'

/**
 * Applies lazy i18n slices on the client (Stage 171.38).
 * Server layouts import `register-*-i18n` for SSR; this mirrors merges into `uiTranslations`
 * before interactive UI reads `getUIText` / `useI18n`.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { getI18nSliceAppliers } from '@/lib/translations/i18n-client-slice-presets'

/**
 * @param {Array<() => void>} applySlices
 */
export function applyI18nSlicesOnClient(applySlices) {
  if (typeof window === 'undefined' || !applySlices?.length) return
  for (const apply of applySlices) {
    apply()
  }
}

/**
 * @param {object} props
 * @param {import('@/lib/translations/i18n-client-slice-presets').I18nSlicePreset} [props.preset]
 * @param {Array<() => void>} [props.applySlices]
 */
export function I18nSliceBootstrap({ preset, applySlices: applySlicesProp }) {
  const applySlices = useMemo(
    () => applySlicesProp ?? (preset ? getI18nSliceAppliers(preset) : []),
    [applySlicesProp, preset],
  )
  const appliedOnClient = useRef(false)

  if (typeof window !== 'undefined' && !appliedOnClient.current && applySlices.length) {
    applyI18nSlicesOnClient(applySlices)
    appliedOnClient.current = true
  }

  useLayoutEffect(() => {
    applyI18nSlicesOnClient(applySlices)
  }, [applySlices])

  return null
}

/**
 * @param {import('@/lib/translations/i18n-client-slice-presets').I18nSlicePreset} preset
 */
export function RouteI18nBootstrap({ preset }) {
  return <I18nSliceBootstrap preset={preset} />
}
