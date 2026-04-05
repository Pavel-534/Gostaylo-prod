#!/usr/bin/env node
/**
 * Локальный stress: отправить N текстовых сообщений в первую беседу.
 *
 * Требуется cookie сессии (скопируйте из DevTools → Application → Cookies):
 *
 *   set GOSTAYLO_SESSION_COOKIE=gostaylo_session=%3Cjwt%3E
 *   set BASE_URL=http://localhost:3000
 *   node scripts/chat-stress-send.mjs
 *
 * В CI предпочтительнее: npx playwright test --project=chat-stress
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const COOKIE = process.env.GOSTAYLO_SESSION_COOKIE || ''
const COUNT = Math.min(100, Math.max(1, parseInt(process.env.STRESS_COUNT || '20', 10) || 20))

if (!COOKIE) {
  console.error('Укажите GOSTAYLO_SESSION_COOKIE (например gostaylo_session=...)')
  process.exit(1)
}

async function main() {
  const headers = {
    'Content-Type': 'application/json',
    Cookie: COOKIE.includes('=') ? COOKIE : `gostaylo_session=${COOKIE}`,
  }

  const lr = await fetch(`${BASE}/api/v2/chat/conversations?archived=all&limit=5`, {
    headers: { ...headers },
    credentials: 'omit',
  })
  if (!lr.ok) {
    console.error('conversations', lr.status, await lr.text())
    process.exit(1)
  }
  const lj = await lr.json()
  const convId = lj?.data?.[0]?.id
  if (!convId) {
    console.error('Нет бесед')
    process.exit(1)
  }

  console.log('conversationId', convId)

  for (let i = 0; i < COUNT; i++) {
    const pr = await fetch(`${BASE}/api/v2/chat/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId: convId,
        content: `cli-stress-${String(i).padStart(2, '0')}`,
        type: 'text',
      }),
    })
    if (!pr.ok) {
      console.error('message', i, pr.status, await pr.text())
      process.exit(1)
    }
  }
  console.log(`OK: отправлено ${COUNT} сообщений`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
