/**
 * Stage 201.07 — header wallet: listings vs invites, short labels, role CTAs.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-07-header-wallet-product-groups.test.js
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = process.cwd()

describe('Stage 201.07 — header wallet product groups', () => {
  it('groups listings vs invites; partner always sees escrow row; dual CTAs', () => {
    const header = readFileSync(`${root}/components/wallet/HeaderWalletCompact.jsx`, 'utf8')
    assert.match(header, /stage73_walletHeaderSectionListings/)
    assert.match(header, /stage73_walletHeaderSectionInvites/)
    assert.match(header, /stage73_walletHeaderFromOrders/)
    assert.match(header, /stage73_walletHeaderToCard/)
    assert.match(header, /stage73_walletHeaderToBookings/)
    assert.match(header, /showPartnerFinancesCta \? \(/)
    assert.match(header, /href="\/partner\/finances"/)
    assert.match(header, /stage73_walletHeaderBonusesCta/)
    assert.match(header, /href="\/profile\/referral"/)
    assert.doesNotMatch(header, /escrowTotal \?\? 0\) > 0/)
    assert.match(header, /icon=\{Landmark\}/)
    assert.match(header, /icon=\{Banknote\}/)
    assert.match(header, /icon=\{PiggyBank\}/)
  })

  it('i18n has short product labels in ru/en/zh/th', () => {
    const i18n = readFileSync(`${root}/lib/translations/slices/profile-app-referral.js`, 'utf8')
    assert.match(i18n, /stage73_walletHeaderSectionInvites: "Приглашения"/)
    assert.match(i18n, /stage73_walletHeaderSectionListings: "Объявления"/)
    assert.match(i18n, /stage73_walletHeaderToCard: "На карту"/)
    assert.match(i18n, /stage73_walletHeaderToBookings: "На брони"/)
    assert.match(i18n, /stage73_walletHeaderFromOrders: "С заказов"/)
    assert.match(i18n, /stage73_walletHeaderBonusesCta: "Бонусы за приглашения"/)
    assert.match(i18n, /stage73_walletHeaderSectionInvites: "Invites"/)
    assert.match(i18n, /stage73_walletHeaderSectionListings: "Listings"/)
    assert.match(i18n, /stage73_walletHeaderSectionInvites: "邀请"/)
    assert.match(i18n, /stage73_walletHeaderSectionInvites: "คำเชิญ"/)
  })
})
