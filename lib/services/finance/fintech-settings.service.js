/**
 * Stage 131.0 — read/update system_fintech_settings with audit + Telegram FINANCE alert.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { SystemConfigService, normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'
import {
  policyToDbRow,
  validateFintechSettingsUpdate,
} from '@/lib/services/finance/fintech-settings-validation.js'
import { insertAuditLog } from '@/lib/services/audit/insert-audit-log.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'

const ENTITY_ID = 'global'

const FIELD_LABELS = Object.freeze({
  acquiring_fee_percent: 'Эквайринг %',
  usn_provision_percent: 'УСН %',
  vat_provision_percent: 'НДС %',
  reserve_bank_percent: 'Банк/прочее %',
  operational_reserve_percent: 'Операционный резерв %',
  safety_lock_max_share: 'Safety lock (доля gross)',
  referral_reinvestment_percent: 'Reinvestment в referral pool %',
  referral_split_ratio: 'Split L1 (legacy ratio)',
  ambassador_guest_l2_enabled: 'Guest L2 включён',
  ambassador_guest_pool_l1_percent: 'Guest pool L1 %',
  ambassador_guest_pool_l2_percent: 'Guest pool L2 %',
  ambassador_guest_pool_referee_percent: 'Guest pool cashback %',
  ambassador_guest_l2_max_thb_per_booking: 'L2 cap / бронь THB',
  ambassador_guest_l2_max_thb_per_month: 'L2 cap / месяц THB',
  referral_monthly_program_cap_thb: 'Program cap / месяц THB',
  referral_withdrawal_fee_percent: 'Комиссия вывода %',
  mlm_level1_percent: 'Host activation L1 %',
  mlm_level2_percent: 'Host activation L2 %',
  partner_activation_bonus_thb: 'Host activation bonus THB',
  ambassador_3_waterfall_enabled: 'Ambassador 3 waterfall',
  ambassador_3_program_cap_enabled: 'Program cap enabled',
})

function formatValue(key, value) {
  if (value === true) return 'да'
  if (value === false) return 'нет'
  if (typeof value === 'number') return String(value)
  return String(value ?? '—')
}

export async function getFintechSettingsRow() {
  const { data, error } = await supabaseAdmin
    .from('system_fintech_settings')
    .select('*')
    .eq('id', ENTITY_ID)
    .maybeSingle()
  if (error) throw new Error(error.message || 'FINTECH_SETTINGS_READ_FAILED')
  return data || null
}

export async function getFintechSettingsForAdmin() {
  const row = await getFintechSettingsRow()
  const policy = normalizeFintechSettingsRow(row)
  return {
    row: row || { id: ENTITY_ID },
    policy,
    api: policyToDbRow(policy),
  }
}

/**
 * @param {object} patch snake_case body from admin API
 * @param {string | null} updatedBy profile id
 */
export async function updateFintechSettings(patch, updatedBy) {
  const currentRow = await getFintechSettingsRow()
  const currentPolicy = normalizeFintechSettingsRow(currentRow)
  const validation = validateFintechSettingsUpdate(patch, currentPolicy)
  if (!validation.ok) {
    return { success: false, ...validation }
  }

  const dbPatch = {
    ...policyToDbRow(validation.merged),
    version: (Number(currentRow?.version) || 1) + 1,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  }

  const { data, error } = await supabaseAdmin
    .from('system_fintech_settings')
    .update(dbPatch)
    .eq('id', ENTITY_ID)
    .select('*')
    .single()

  if (error) {
    return { success: false, error: 'UPDATE_FAILED', message: error.message || 'UPDATE_FAILED' }
  }

  SystemConfigService.invalidateCache()

  const changes = diffSnakePatch(currentRow, data, validation.patch)
  await recordFintechSettingsAudit({ updatedBy, changes, version: data.version })

  return { success: true, data, policy: normalizeFintechSettingsRow(data), changes }
}

function diffSnakePatch(beforeRow, afterRow, patch) {
  const changes = []
  for (const key of Object.keys(patch)) {
    const oldVal = beforeRow?.[key]
    const newVal = afterRow?.[key]
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changes.push({ field: key, label: FIELD_LABELS[key] || key, oldValue: oldVal, newValue: newVal })
    }
  }
  return changes
}

async function recordFintechSettingsAudit({ updatedBy, changes, version }) {
  if (!changes?.length) return

  await insertAuditLog({
    userId: updatedBy || null,
    action: 'FINTECH_SETTINGS_UPDATE',
    entityType: 'system_fintech_settings',
    entityId: ENTITY_ID,
    payload: { version, changes },
  })

  for (const ch of changes) {
    const label = ch.label || ch.field
    const line = `⚠️ Изменение финтех-настроек пользователем ${updatedBy || 'system'}. ${label}: ${formatValue(ch.field, ch.oldValue)} → ${formatValue(ch.field, ch.newValue)}`
    void sendToAdminTopic('FINANCE', line)

    void supabaseAdmin.from('system_fintech_settings_audit').insert({
      settings_id: ENTITY_ID,
      changed_by: updatedBy || null,
      field_name: ch.field,
      old_value: formatValue(ch.field, ch.oldValue),
      new_value: formatValue(ch.field, ch.newValue),
      settings_version: version,
    })
  }
}

export default {
  getFintechSettingsRow,
  getFintechSettingsForAdmin,
  updateFintechSettings,
}
