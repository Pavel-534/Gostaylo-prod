/**
 * Stage 202.19 — legal glossary §1 for YooKassa / public offer + partner terms.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-19-legal-glossary.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.19 — legal glossary §1', () => {
  it('LegalDefinitionsSection is SSOT with required YooKassa terms', () => {
    const glossary = read('components/legal/LegalDefinitionsSection.jsx')
    assert.match(glossary, /Термины и определения/)
    assert.match(glossary, /Terms and definitions/)
    assert.match(glossary, /Платформа \(Оператор\)/)
    assert.match(glossary, /Партнёр \(Хост\)/)
    assert.match(glossary, /Гость \(Пользователь\)/)
    assert.match(glossary, /Агентский договор \/ Оферта/)
    assert.match(glossary, /Бронирование/)
    assert.match(glossary, /Агентское вознаграждение/)
    assert.match(glossary, /Платёжный партнёр/)
    assert.match(glossary, /getLegalPublisherDetails/)
    assert.match(glossary, /variant === 'partner-terms'/)
  })

  it('public offer and partner terms include §1 glossary and renumbered body', () => {
    const offer = read('components/legal/PublicOfferLegalContent.jsx')
    assert.match(offer, /LegalDefinitionsSection variant="public-offer"/)
    assert.match(offer, /2\. Роли сторон/)
    assert.match(offer, /8\. Ответственность и претензии/)
    assert.match(offer, /11\. Изменение оферты/)

    const partner = read('components/legal/PartnerTermsLegalContent.jsx')
    assert.match(partner, /LegalDefinitionsSection variant="partner-terms"/)
    assert.match(partner, /2\. Статус Партнёра/)
    assert.match(partner, /11\. Изменение условий/)
  })

  it('legal version bump reflects glossary change', () => {
    const ver = read('lib/config/legal-terms-version.js')
    assert.match(ver, /2026-09-02-v1/)

    const details = read('lib/config/legal-details.js')
    assert.match(details, /2 сентября 2026/)
  })
})
