/**
 * Stage 118.1 — маркеры мусорных сообщений Playwright chat-stress (`st…-seq-N`).
 */

import { E2E_TEST_DATA_TAG } from './test-data-tag.js'

export const E2E_CHAT_STRESS_TAG = '[E2E_CHAT_STRESS]'

/** Legacy Playwright runId + seq (без тега) — попадали в реальные чаты. */
const LEGACY_STRESS_SEQ_RE = /^st[a-z0-9]{4,}-seq-\d+$/i

/**
 * @param {unknown} raw
 */
export function isChatE2eStressGarbageContent(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return false
  if (s.includes(E2E_CHAT_STRESS_TAG)) return true
  if (s.includes(E2E_TEST_DATA_TAG) && s.includes('-seq-')) return true
  return LEGACY_STRESS_SEQ_RE.test(s)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function cleanupChatStressGarbageMessages(sb, opts = {}) {
  const dryRun = opts.dryRun !== false
  const ids = new Set()

  for (const pattern of ['st%-seq-%', `%${E2E_CHAT_STRESS_TAG}%`]) {
    for (let pass = 0; pass < 50; pass += 1) {
      const { data, error } = await sb.from('messages').select('id,content').like('content', pattern).limit(500)
      if (error) {
        console.warn('[cleanup-test-data] chat stress scan:', error.message)
        break
      }
      for (const row of data || []) {
        if (row?.id && isChatE2eStressGarbageContent(row.content)) ids.add(String(row.id))
      }
      if (!data?.length || data.length < 500) break
    }
  }

  const idList = [...ids]
  if (!idList.length) {
    return { count: 0, dryRun }
  }

  if (dryRun) {
    return { count: idList.length, dryRun }
  }

  const CHUNK = 150
  let deleted = 0
  for (let i = 0; i < idList.length; i += CHUNK) {
    const part = idList.slice(i, i + CHUNK)
    const { count, error } = await sb.from('messages').delete({ count: 'exact' }).in('id', part)
    if (error) {
      console.warn('[cleanup-test-data] chat stress delete:', error.message)
    } else if (typeof count === 'number') {
      deleted += count
    }
  }

  return { count: deleted, dryRun }
}
