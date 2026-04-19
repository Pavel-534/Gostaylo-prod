/**
 * Печать строк public.payout_methods как их видит сервер (Supabase service role).
 * Не меняет данные.
 *
 * Запуск (PowerShell из корня репозитория), подставьте значения из .env / Vercel:
 *
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/check-payout-methods.mjs
 *
 * Или одной строкой из .env.local (не коммитьте ключи):
 *   Get-Content .env.local | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"'), 'Process') } }; node scripts/check-payout-methods.mjs
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    'Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении (как у Next.js API).',
  )
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase
  .from('payout_methods')
  .select('id,name,channel,fee_type,value,currency,min_payout,is_active,updated_at')
  .order('id')

if (error) {
  console.error('Supabase error:', error.message)
  process.exit(1)
}

console.log('Строки payout_methods (сырое fee_type из БД):\n')
for (const row of data || []) {
  const ft = row.fee_type
  const ftRepr = ft === null || ft === undefined ? String(ft) : JSON.stringify(ft)
  console.log(
    `${row.id}\tname=${row.name}\tfee_type(raw)=${ftRepr}\tvalue=${row.value}\t${row.currency}\tmin=${row.min_payout}`,
  )
}

const card = (data || []).find((r) => r.id === 'pm-card-ru')
if (card) {
  console.log('\n--- pm-card-ru ---')
  console.log('fee_type (typeof):', typeof card.fee_type, card.fee_type)
  if (String(card.fee_type).toLowerCase() !== 'percentage') {
    console.log(
      '\nДля партнёра строка будет как «фикс в валюте», пока fee_type не станет percentage в БД.',
    )
    console.log('См. scripts/sql/payout_methods_diagnose.sql — блок UPDATE (после проверки).')
  }
}
