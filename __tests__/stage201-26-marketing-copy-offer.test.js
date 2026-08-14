/**
 * Stage 201.26 — marketing copy ≤ public offer (no invented /legal/terms, no 24/7 SLA,
 * payment partner holds funds, KYC badge is verified partner).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-26-marketing-copy-offer.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.26 — marketing copy ≤ offer', () => {
  it('publisher note uses legal SSOT and appears on home + help', () => {
    const note = read('components/legal/LegalPublisherNote.jsx')
    assert.match(note, /getLegalPublisherDetails/)
    assert.match(note, /ИНН/)
    assert.match(note, /ОГРНИП/)

    const home = read('components/PlatformHomeContent.jsx')
    assert.match(home, /LegalPublisherNote/)

    const help = read('app/(marketing)/help/page.js')
    assert.match(help, /LegalPublisherNote/)
    assert.match(help, /href="\/legal\/public-offer\/"/)
    assert.match(help, /href="\/legal\/refund\/"/)
    assert.doesNotMatch(help, /\/legal\/terms/)
    assert.match(help, /нескольких часов/)
    assert.match(help, /платёжного партнёра/)
    assert.match(help, /не принимает оплату «на свой эскроу-счёт»/)
  })

  it('About stays stay-first without housing-only or middlemen-free claims', () => {
    const src = read('components/about/AboutContent.jsx')
    assert.match(src, /eyebrow: 'Супер-приложение'/)
    assert.match(src, /собственниками/)
    assert.match(src, /представителями/)
    assert.match(src, /Таиланде и России/)
    assert.match(src, /Пхукет/)
    assert.doesNotMatch(src, /без посредников/)
    assert.match(src, /платёжным партнёром/)
    assert.match(src, /рабочие часы/)
  })

  it('checkout trust + home how-it-works do not promise 24/7 or guaranteed refund', () => {
    const checkout = read('lib/translations/checkout.js')
    assert.match(checkout, /средства удерживает платёжный партнёр/)
    assert.match(checkout, /Возврат — по оферте и правилам объявления/)
    assert.doesNotMatch(checkout, /гарантированн/)

    const common = read('lib/translations/common-ui.js')
    assert.match(common, /Служба поддержки отвечает в рабочие часы/)
    assert.doesNotMatch(common, /howStep3Desc": "[^"]*24\/7/)
  })

  it('PDP trust badge and partner KYC chip drop Escrow / host wording', async () => {
    const { listingsPublicUi } = await import('../lib/translations/listings-public.js')
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const label = listingsPublicUi[lang].listingBookingTrust_escrow
      assert.ok(label.includes('{brand}'))
      assert.doesNotMatch(label, /Escrow/i)
    }

    const { partnerShellUi } = await import('../lib/translations/slices/partner-shell.js')
    assert.equal(partnerShellUi.ru.listingCard_verifiedPartner, 'Подтверждённый партнёр')
    assert.equal(partnerShellUi.en.listingCard_verifiedPartner, 'Verified partner')
  })

  it('profile partner pitch drops Phuket network and 24/7', () => {
    const src = read('app/(storefront)/profile/components/ProfileInfo.jsx')
    assert.doesNotMatch(src, /24\/7/)
    assert.doesNotMatch(src, /Пхукет/)
    assert.match(src, /Таиланд и Россия/)
    assert.match(src, /Поддержка в рабочие часы/)
  })

  it('does not invent /legal/terms; PAID_ESCROW status id stays', () => {
    const help = read('app/(marketing)/help/page.js')
    const about = read('components/about/AboutContent.jsx')
    const terms = read('components/terms/TermsContent.jsx')
    for (const src of [help, about, terms]) {
      assert.doesNotMatch(src, /\/legal\/terms/)
    }

    const fsm = read('lib/booking/status-transitions.js')
    assert.match(fsm, /PAID_ESCROW/)
  })
})
