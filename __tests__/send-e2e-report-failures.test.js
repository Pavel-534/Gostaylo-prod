/**
 * send-e2e-report — failed test line extraction from Playwright JSON.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/send-e2e-report-failures.test.js
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { collectFailedPlaywrightTestLines } from '../scripts/send-e2e-report.mjs'

test('collectFailedPlaywrightTestLines extracts failed specs', () => {
  const json = {
    suites: [
      {
        title: 'role-access.spec.ts',
        specs: [
          {
            title: 'видит Объявления',
            ok: false,
            tests: [
              {
                projectName: 'rbac-partner',
                results: [{ status: 'failed', error: { message: 'Timeout 30000ms exceeded.' } }],
              },
            ],
          },
        ],
      },
    ],
  }
  const lines = collectFailedPlaywrightTestLines(json)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /rbac-partner/)
  assert.match(lines[0], /Объявления/)
})

test('collectFailedPlaywrightTestLines returns empty when all passed', () => {
  const json = {
    suites: [
      {
        specs: [
          {
            title: 'ok spec',
            ok: true,
            tests: [{ projectName: 'security-bot', results: [{ status: 'passed' }] }],
          },
        ],
      },
    ],
  }
  assert.deepEqual(collectFailedPlaywrightTestLines(json), [])
})
