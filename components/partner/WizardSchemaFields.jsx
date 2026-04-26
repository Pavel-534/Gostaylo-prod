'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { NANNY_LANG_OPTIONS } from '@/lib/search/nanny-search-langs'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'

/**
 * @param {import('@/lib/config/category-form-schema').WizardFormFieldDef} field
 * @param {Record<string, unknown>} metadata
 * @param {(key: string, value: unknown) => void} updateMetadata
 * @param {(key: string) => string} t
 * @param {string} [language]
 */
function langOptionLabel(row, language) {
  return row[language] || row.en
}

function renderField(field, metadata, updateMetadata, t, language = 'ru') {
  if (field.type === 'languages_multi') {
    const key = field.key || 'languages'
    const langs = Array.isArray(metadata[key]) ? metadata[key] : []
    const langSet = new Set(langs.map((x) => String(x).toLowerCase()))
    const toggle = (id) => {
      const next = new Set(langSet)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      updateMetadata(key, [...next])
    }
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {NANNY_LANG_OPTIONS.map((row) => {
            const checked = langSet.has(row.id)
            return (
              <label
                key={row.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200',
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(row.id)} />
                {langOptionLabel(row, language)}
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  if (field.type === 'boolean') {
    const checked = metadata[field.key] === true || metadata[field.key] === 'true'
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={`wiz-${field.key}`}
          checked={checked}
          onCheckedChange={(v) => updateMetadata(field.key, v === true)}
        />
        <Label htmlFor={`wiz-${field.key}`} className="text-sm font-medium text-slate-700 cursor-pointer">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <>
        <Label className="text-sm font-medium text-slate-700">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
        <Textarea
          value={String(metadata[field.key] ?? '')}
          onChange={(e) => updateMetadata(field.key, e.target.value)}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          className="mt-2 min-h-[88px]"
          maxLength={4000}
        />
      </>
    )
  }

  if (field.type === 'string') {
    return (
      <>
        <Label className="text-sm font-medium text-slate-700">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
        <Input
          type="text"
          value={String(metadata[field.key] ?? '')}
          onChange={(e) => updateMetadata(field.key, e.target.value)}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          className="mt-2 h-11"
        />
      </>
    )
  }

  if (field.type === 'select' && field.options?.length) {
    const raw = metadata[field.key]
    const val = raw != null && String(raw).trim() ? String(raw).toLowerCase() : 'unset'
    return (
      <>
        <Label className="text-sm font-medium text-slate-700">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
        <Select value={val} onValueChange={(v) => updateMetadata(field.key, v === 'unset' ? '' : v)}>
          <SelectTrigger className="mt-2 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    )
  }

  if (field.type === 'number') {
    const min = field.min ?? 0
    const max = field.max ?? 99_999_999
    const rawVal = metadata[field.key]
    let display = ''
    if (rawVal != null && rawVal !== '') display = String(rawVal)
    else if (!field.optionalEmpty) display = String(min)

    return (
      <>
        <Label className="text-sm font-medium text-slate-700">
          {t(field.labelKey)}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </Label>
        <Input
          inputMode="numeric"
          autoComplete="off"
          value={field.optionalEmpty ? display : display || String(min)}
          onChange={(e) => {
            if (field.optionalEmpty) {
              const v = clampIntFromDigits(e.target.value, min, max, undefined)
              if (v === undefined) updateMetadata(field.key, '')
              else updateMetadata(field.key, v)
            } else {
              updateMetadata(field.key, clampIntFromDigits(e.target.value, min, max, min))
            }
          }}
          onBlur={
            field.yearBlur
              ? () => {
                  const digits = String(metadata[field.key] ?? '').replace(/\D/g, '').slice(0, 4)
                  if (!digits) {
                    updateMetadata(field.key, '')
                    return
                  }
                  const n = parseInt(digits, 10)
                  if (!Number.isFinite(n) || n < (field.min ?? 1985)) {
                    updateMetadata(field.key, '')
                    return
                  }
                  updateMetadata(field.key, Math.min(field.max ?? 2100, n))
                }
              : undefined
          }
          className="mt-2 h-11"
        />
      </>
    )
  }

  return null
}

/**
 * @param {{
 *   fields: import('@/lib/config/category-form-schema').WizardFormFieldDef[],
 *   metadata: Record<string, unknown>,
 *   updateMetadata: (key: string, value: unknown) => void,
 *   t: (key: string) => string,
 *   fuelPolicyHint?: boolean,
 *   language?: string,
 * }} props
 */
export function WizardSchemaFields({ fields, metadata, updateMetadata, t, fuelPolicyHint = false, language = 'ru' }) {
  if (!fields?.length) return null

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {fields.map((field) => {
        const fullRow =
          field.gridSpan === 2 || field.type === 'text' || field.type === 'languages_multi'
        const inner =
          field.key === 'fuel_policy' && fuelPolicyHint ? (
            <div className="space-y-2">
              {renderField(field, metadata, updateMetadata, t, language)}
              <p className="text-xs text-slate-600 leading-relaxed">{t('fieldFuelPolicyHint')}</p>
            </div>
          ) : (
            renderField(field, metadata, updateMetadata, t, language)
          )
        return (
          <div key={field.key} className={fullRow ? 'sm:col-span-2' : ''}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
