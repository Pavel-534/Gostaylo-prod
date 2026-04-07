import { test, expect } from '@playwright/test'

const E2E_FIXTURE_SECRET = String(process.env.E2E_FIXTURE_SECRET || '').trim()

test('notification integrity: deep link, ics attachment, telegram ban token', async ({ request }) => {
  test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET is required')

  const res = await request.post('/api/v2/test/notifications/integrity', {
    headers: { 'x-e2e-fixture-secret': E2E_FIXTURE_SECRET },
    data: { lang: 'zh' },
  })

  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as {
    success?: boolean
    data?: {
      hasConversationDeepLink?: boolean
      hasFallbackMessagesOnly?: boolean
      calendarTokenPresent?: boolean
      icsAttachmentPresent?: boolean
      icsAttachmentName?: string | null
      banTokenValid?: boolean
      zhPrefersIcsCopy?: boolean | null
    }
  }

  expect(body.success).toBeTruthy()
  expect(body.data?.hasConversationDeepLink).toBeTruthy()
  expect(body.data?.calendarTokenPresent).toBeTruthy()
  expect(body.data?.icsAttachmentPresent).toBeTruthy()
  expect(body.data?.icsAttachmentName).toBe('gostaylo-stay.ics')
  expect(body.data?.banTokenValid).toBeTruthy()
  expect(body.data?.zhPrefersIcsCopy).toBeTruthy()

  expect(body.data?.hasFallbackMessagesOnly).toBeFalsy()
})

