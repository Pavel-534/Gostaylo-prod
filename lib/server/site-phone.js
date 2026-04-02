/**
 * Телефон для Schema.org (LodgingBusiness.telephone): только system_settings.general.sitePhone (админка).
 * Если пусто — null (поле telephone в JSON-LD не выводим). Не для UI карточки.
 */
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

export const getCachedSitePhoneForSchema = cache(async () => {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle()
  if (error || !data?.value || typeof data.value !== 'object') return null
  const raw = data.value.sitePhone
  if (raw == null) return null
  const s = String(raw).trim()
  return s || null
})
