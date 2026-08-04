/**
 * Stage 200.25 — Admin UX P2 (RU shell / menu / dashboard labels).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-25-admin-ux-p2.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.25 — admin menu RU titles', () => {
  it('replaces English nav titles with Russian', () => {
    const src = read('lib/admin/admin-menu.ts')
    assert.match(src, /title: 'Обзор'/)
    assert.match(src, /Здоровье витрины/)
    assert.match(src, /Лист ожидания/)
    assert.match(src, /Финансовая аналитика/)
    assert.match(src, /Состояние системы/)
    assert.match(src, /Журнал аудита/)
    assert.doesNotMatch(src, /title: 'Dashboard'/)
    assert.doesNotMatch(src, /title: 'Waitlist'/)
    assert.doesNotMatch(src, /title: 'Marketplace Health'/)
    assert.doesNotMatch(src, /title: 'System Health'/)
    assert.doesNotMatch(src, /title: 'Audit log'/)
    assert.doesNotMatch(src, /Advanced: System/)
  })
})

describe('Stage 200.25 — dashboard + moderation category i18n', () => {
  it('dashboard hub uses RU labels', () => {
    const src = read('app/admin/page.js')
    assert.match(src, /Главная панель/)
    assert.match(src, /на проверке/)
    assert.match(src, /Модерация и одобрение/)
    assert.doesNotMatch(src, /<h1[^>]*>Admin Dashboard</)
    assert.doesNotMatch(src, /\bPENDING\b/)
    assert.doesNotMatch(src, /<h3 className="font-semibold">Users</)
  })

  it('moderation resolves category display names', () => {
    const src = read('app/admin/moderation/page.js')
    assert.match(src, /resolveCategoryDisplayName/)
    assert.match(src, /categoryLabel/)
  })
})
