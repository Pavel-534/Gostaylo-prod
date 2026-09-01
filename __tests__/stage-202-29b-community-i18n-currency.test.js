/**
 * Stage 202.29b — community i18n currency polish (copy-only).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-29b-community-i18n-currency.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { leaderQuestsUi } from '@/lib/translations/slices/leader-quests.js'
import { localLeaderTierUi } from '@/lib/translations/slices/local-leader-tier.js'
import { profileAppReferralUi } from '@/lib/translations/slices/profile-app-referral.js'

const LANGS = ['ru', 'en', 'zh', 'th']

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

function sliceValuesNoThb(slice) {
  for (const lang of LANGS) {
    const values = Object.values(slice[lang] || {})
    for (const v of values) {
      assert.doesNotMatch(String(v), /\bTHB\b/i, `unexpected THB in ${lang}`)
    }
  }
}

describe('stage-202-29b community i18n currency', () => {
  it('leader-quests.js has no THB literal in any language', () => {
    sliceValuesNoThb(leaderQuestsUi)
  })

  it('local-leader-tier.js has no THB literal in any language', () => {
    sliceValuesNoThb(localLeaderTierUi)
  })

  it('leaderQuests_disclaimer mentions display currency, not fixed THB cap', () => {
    for (const lang of LANGS) {
      const text = leaderQuestsUi[lang].leaderQuests_disclaimer
      assert.ok(text, lang)
      assert.doesNotMatch(text, /\bTHB\b/i)
      assert.doesNotMatch(text, /100/)
    }
  })

  it('campaign settings keys exist in all 4 languages', () => {
    const keys = [
      'stage1143_campaignLabel',
      'stage1143_campaignNone',
      'stage1143_campaignHint',
      'stage1143_campaignSave',
      'stage1143_campaignSaving',
      'stage1143_campaignSaved',
      'stage1143_campaignSaveErr',
    ]
    for (const lang of LANGS) {
      for (const key of keys) {
        assert.ok(profileAppReferralUi[lang]?.[key], `${lang}.${key}`)
      }
    }
  })

  it('LocalLeaderTier uses ReferralLedgerAmount for earned gap (Stage 188 pattern)', () => {
    const src = read('components/referral/LocalLeaderTier.jsx')
    assert.match(src, /ReferralLedgerAmount/)
    assert.match(src, /localLeaderTier_missing_earned_lead/)
    assert.doesNotMatch(src, /localLeaderTier_missing_earned[^_]/)
  })

  it('QuestsBlock uses ReferralLedgerAmount for rewards', () => {
    const src = read('components/referral/QuestsBlock.jsx')
    assert.match(src, /ReferralLedgerAmount/)
    assert.doesNotMatch(src, /THB/)
  })

  it('ReferralProfileTabSettings has no hardcoded Cyrillic literals', () => {
    const src = read('components/referral/ReferralProfileTabSettings.jsx')
    assert.doesNotMatch(src, /[А-Яа-яЁё]/)
    assert.match(src, /stage1143_campaignSaved/)
    assert.match(src, /stage1143_campaignLabel/)
  })

  it('Stage 202.22 engagement contract still holds', () => {
    assert.match(read('components/referral/QuestsBlock.jsx'), /leaderQuests_disclaimer/)
    assert.match(read('lib/translations/slices/leader-quests.js'), /leaderQuests_disclaimer/)
  })
})
