#!/usr/bin/env node
/**
 * Nightly E2E summary → Telegram (Playwright JSON + опционально Supabase health).
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional: PLAYWRIGHT_JSON_REPORT, E2E_REPORT_TIME_UTC, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FCM_CLEANED_COUNT
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const reportPath =
  process.env.PLAYWRIGHT_JSON_REPORT || path.join(root, 'playwright-report', 'results.json')

async function sendTelegram(html) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) {
    console.warn('[e2e-report] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing — skip Telegram')
    process.exit(0)
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const body = new URLSearchParams({
    chat_id: chat,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: 'true',
  })
  const res = await fetch(url, { method: 'POST', body })
  if (!res.ok) {
    const t = await res.text()
    console.error('[e2e-report] Telegram HTTP error:', t)
    process.exit(1)
  }
}

function timeLine() {
  const fixed = process.env.E2E_REPORT_TIME_UTC
  if (fixed) {
    return `🕒 <b>Время (UTC):</b> ${fixed}`
  }
  const d = new Date()
  return `🕒 <b>Время (UTC):</b> ${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

async function gatherOperationalBlock() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  if (!url || !key) {
    return [
      `🧹 <b>Гигиена токенов:</b> Удалено <b>n/a</b> неактивных устройств.`,
      `🧹 <b>Sweeper:</b> Спасено <b>n/a</b> зависших пушей.`,
      `💰 <b>Безопасность:</b> Попыток подмены цены: <b>n/a</b>.`,
      `🏥 <b>Здоровье БД:</b> <b>n/a</b>.`,
    ]
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let fcmCleaned = null
  let sweeperSaved = null
  let tamperCount = null
  let dbHealth = 'OK'

  try {
    const { data, error } = await client
      .from('ops_job_runs')
      .select('job_name,status,stats,error_message')
      .gte('started_at', sinceIso)
      .in('job_name', ['push-token-hygiene', 'push-sweeper', 'ical-sync', 'payouts'])
    if (error) {
      throw new Error(error.message || 'ops_job_runs query failed')
    }
    const rows = Array.isArray(data) ? data : []
    fcmCleaned = rows
      .filter((r) => r.job_name === 'push-token-hygiene' && r.status === 'success')
      .reduce((acc, r) => acc + Number(r?.stats?.removed || 0), 0)
    sweeperSaved = rows
      .filter((r) => r.job_name === 'push-sweeper' && r.status === 'success')
      .reduce((acc, r) => acc + Number(r?.stats?.delivered || 0), 0)
    const hasOpsErrors = rows.some((r) => r.status === 'error')
    if (hasOpsErrors) dbHealth = 'DEGRADED'
  } catch {
    dbHealth = 'DEGRADED'
  }

  try {
    const { error: pErr } = await client.from('profiles').select('id').limit(1)
    if (pErr) dbHealth = 'DEGRADED'
  } catch {
    dbHealth = 'DEGRADED'
  }

  try {
    const { count, error: tErr } = await client
      .from('critical_signal_events')
      .select('*', { count: 'exact', head: true })
      .eq('signal_key', 'PRICE_TAMPERING')
      .gte('created_at', sinceIso)
    if (!tErr) {
      tamperCount = Number(count || 0)
    }
  } catch {
    tamperCount = null
  }

  return [
    `🧹 <b>Гигиена токенов:</b> Удалено <b>${fcmCleaned ?? 'n/a'}</b> неактивных устройств.`,
    `🧹 <b>Sweeper:</b> Спасено <b>${sweeperSaved ?? 'n/a'}</b> зависших пушей.`,
    `💰 <b>Безопасность:</b> Попыток подмены цены: <b>${tamperCount ?? 'n/a'}</b>.`,
    `🏥 <b>Здоровье БД:</b> <b>${dbHealth === 'OK' ? 'OK' : 'DEGRADED'}</b>.`,
  ]
}

async function main() {
  let raw
  try {
    raw = fs.readFileSync(reportPath, 'utf8')
  } catch (e) {
    console.warn('[e2e-report] No report file:', reportPath, e?.message || e)
    const monitor = await gatherOperationalBlock()
    await sendTelegram(
      `🤖 <b>Бортовой журнал Gostaylo</b>\n\n` +
        `⚠️ Нет файла <code>playwright-report/results.json</code> (прогон не записал JSON).\n` +
        `${timeLine()}\n` +
        monitor.join('\n'),
    )
    process.exit(0)
  }

  let json
  try {
    json = JSON.parse(raw)
  } catch {
    const monitor = await gatherOperationalBlock()
    await sendTelegram(
      `🤖 <b>Бортовой журнал Gostaylo</b>\n\n` +
        `⚠️ Повреждённый JSON отчёта.\n` +
        `${timeLine()}\n` +
        monitor.join('\n'),
    )
    process.exit(0)
  }

  const stats = json.stats || {}
  const passed = stats.expected ?? 0
  const failed = stats.unexpected ?? 0
  const skipped = stats.skipped ?? 0
  const flaky = stats.flaky ?? 0

  const runLink =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : ''

  const monitor = await gatherOperationalBlock()

  const lines = [
    `🤖 <b>Бортовой журнал Gostaylo</b>`,
    '',
    `✅ <b>Тесты:</b> ${passed} пройдены успешно.` +
      (failed ? ` Ошибок: ${failed}.` : '') +
      (skipped ? ` Пропусков: ${skipped}.` : '') +
      (flaky ? ` Flaky: ${flaky}.` : ''),
    timeLine(),
    ...monitor,
  ]

  if (runLink) {
    lines.push('', `<a href="${runLink}">Открыть workflow</a>`)
  }

  await sendTelegram(lines.join('\n'))
}

await main()
