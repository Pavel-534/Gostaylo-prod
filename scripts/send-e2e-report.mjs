#!/usr/bin/env node
/**
 * Nightly E2E summary → Telegram (Playwright JSON + опционально Supabase health).
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional: PLAYWRIGHT_JSON_REPORT, E2E_REPORT_TIME_UTC, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const reportPath =
  process.env.PLAYWRIGHT_JSON_REPORT || path.join(root, 'playwright-report', 'results.json')

function walkSuites(suites, acc, parentFile) {
  if (!Array.isArray(suites)) return
  for (const s of suites) {
    const file = s.file || parentFile || ''
    if (s.specs && Array.isArray(s.specs)) {
      for (const spec of s.specs) {
        const tests = spec.tests || []
        for (const test of tests) {
          const project = test.projectName || test.projectId || ''
          const results = test.results || []
          const last = results[results.length - 1]
          const status = last?.status || 'unknown'
          acc.push({
            file,
            project,
            title: spec.title || test.title || '',
            status,
          })
        }
      }
    }
    if (s.suites?.length) walkSuites(s.suites, acc, file || parentFile)
  }
}

function botLine(tests, fileNeedle, projectNeedle, emoji, label) {
  const relevant = tests.filter(
    (t) =>
      (t.file && t.file.includes(fileNeedle)) ||
      (t.project && String(t.project).toLowerCase().includes(projectNeedle)),
  )
  if (relevant.length === 0) {
    return `${emoji} <b>${label}:</b> n/a`
  }
  const bad = relevant.filter((t) =>
    ['failed', 'timedOut', 'interrupted'].includes(t.status),
  )
  return bad.length === 0
    ? `${emoji} <b>${label}:</b> OK`
    : `${emoji} <b>${label}:</b> FAIL (${bad.length})`
}

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

async function gatherMonitoringBlock() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return [
      '',
      '📡 <b>Мониторинг:</b>',
      `• Активных FCM-устройств: <i>n/a</i> (нет <code>SUPABASE_*</code> в env шага)`,
      `• Supabase: <i>n/a</i>`,
      `• Попыток взлома цены <code>[PRICE_TAMPERING]</code> за 24ч: <i>n/a</i>`,
    ]
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let deviceCount = '?'
  let supabaseLine = '❌ ошибка'
  let tamperCount = '?'

  try {
    const { count, error: cErr } = await client
      .from('user_push_tokens')
      .select('*', { count: 'exact', head: true })
    if (cErr) {
      deviceCount = `ошибка: ${cErr.message?.slice(0, 80) || 'query'}`
    } else {
      deviceCount = String(count ?? 0)
    }
  } catch (e) {
    deviceCount = `ошибка: ${e?.message || e}`
  }

  try {
    const { error: pErr } = await client.from('profiles').select('id').limit(1)
    supabaseLine = pErr ? `❌ ${pErr.message?.slice(0, 120) || 'error'}` : '✅ REST OK'
  } catch (e) {
    supabaseLine = `❌ ${e?.message || e}`
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  try {
    const { count, error: tErr } = await client
      .from('critical_signal_events')
      .select('*', { count: 'exact', head: true })
      .eq('signal_key', 'PRICE_TAMPERING')
      .gte('created_at', since)
    if (tErr) {
      if (String(tErr.message || '').includes('critical_signal_events')) {
        tamperCount = 'таблица не развёрнута'
      } else {
        tamperCount = `ошибка: ${tErr.message?.slice(0, 80)}`
      }
    } else {
      tamperCount = String(count ?? 0)
    }
  } catch (e) {
    tamperCount = `ошибка: ${e?.message || e}`
  }

  return [
    '',
    '📡 <b>Мониторинг:</b>',
    `• Активных FCM-устройств (строк в <code>user_push_tokens</code>): <b>${deviceCount}</b>`,
    `• Supabase: ${supabaseLine}`,
    `• Попыток взлома цены <code>[PRICE_TAMPERING]</code> за 24ч: <b>${tamperCount}</b>`,
  ]
}

async function main() {
  let raw
  try {
    raw = fs.readFileSync(reportPath, 'utf8')
  } catch (e) {
    console.warn('[e2e-report] No report file:', reportPath, e?.message || e)
    const monitor = await gatherMonitoringBlock()
    await sendTelegram(
      `🌙 <b>Ночной отчёт: Gostaylo.com</b>\n\n` +
        `⚠️ Нет файла <code>playwright-report/results.json</code> (прогон не записал JSON).\n` +
        `${timeLine()}` +
        monitor.join('\n'),
    )
    process.exit(0)
  }

  let json
  try {
    json = JSON.parse(raw)
  } catch {
    const monitor = await gatherMonitoringBlock()
    await sendTelegram(
      `🌙 <b>Ночной отчёт: Gostaylo.com</b>\n\n` +
        `⚠️ Повреждённый JSON отчёта.\n` +
        `${timeLine()}` +
        monitor.join('\n'),
    )
    process.exit(0)
  }

  const stats = json.stats || {}
  const passed = stats.expected ?? 0
  const failed = stats.unexpected ?? 0
  const skipped = stats.skipped ?? 0
  const flaky = stats.flaky ?? 0

  const tests = []
  walkSuites(json.suites || [], tests, '')

  const runLink =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : ''

  const monitor = await gatherMonitoringBlock()

  const lines = [
    `🌙 <b>Ночной отчёт: Gostaylo.com</b>`,
    '',
    `✅ <b>Тесты:</b> ${passed} пройдено / ${failed} ошибок` +
      (skipped ? ` (пропусков: ${skipped})` : '') +
      (flaky ? ` (flaky: ${flaky})` : ''),
    botLine(tests, 'accountant-math', 'accountant', '💰', 'Accountant Bot'),
    botLine(tests, 'chat-control', 'chat-control', '💬', 'Chat Guard'),
    timeLine(),
    ...monitor,
  ]

  if (runLink) {
    lines.push('', `<a href="${runLink}">Открыть workflow</a>`)
  }

  await sendTelegram(lines.join('\n'))
}

await main()
