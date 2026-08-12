/**
 * Stage 200.112 — Partner guest-review / promo / settings i18n sweep (no API change).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-112-partner-i18n-sweep.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.112 — partner i18n sweep', () => {
  it('guest-review page uses getUIText keys; keeps guest-reviews POST', () => {
    const page = read('app/(partner)/partner/bookings/[bookingId]/guest-review/page.js')
    assert.match(page, /getUIText/)
    assert.match(page, /useI18n/)
    assert.match(page, /partnerGuestReview_rateTitle/)
    assert.match(page, /partnerGuestReview_needRating/)
    assert.match(page, /partnerGuestReview_success/)
    assert.match(page, /\/api\/v2\/partner\/guest-reviews/)
    assert.match(page, /handleSubmit/)
    assert.doesNotMatch(page, /Выберите оценку от 1 до 5/)
    assert.doesNotMatch(page, /Спасибо! Отзыв о госте сохранён/)
  })

  it('promo flash extend toasts and settings save error use i18n', () => {
    const promo = read('app/(partner)/partner/promo/page.js')
    const settings = read('app/(partner)/partner/settings/page.js')
    assert.match(promo, /partnerPromo_flashExtendError/)
    assert.match(promo, /partnerPromo_flashExtendSuccess/)
    assert.match(promo, /partnerPromo_flashExtendNetwork/)
    assert.doesNotMatch(promo, /Не удалось продлить Flash Sale/)
    assert.match(settings, /partnerSettingsSaveError/)
    assert.doesNotMatch(settings, /toast\.error\(data\.error \|\| 'Ошибка сохранения'\)/)
  })

  it('i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-shell.js')
    for (const key of [
      'partnerGuestReview_pageTitle',
      'partnerGuestReview_rateTitle',
      'partnerGuestReview_success',
      'partnerPromo_flashExtendSuccess',
      'partnerPromo_flashExtendNetwork',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
