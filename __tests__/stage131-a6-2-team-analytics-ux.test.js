/**
 * Stage 131.A6.2 — team analytics UX fixes.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a6-2-team-analytics-ux.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A6.2 — team analytics UX', () => {
  it('SQL RPC returns l3_network_thb and distinct counts', () => {
    const src = read('migrations/stage131_a62_team_analytics_l3.sql')
    assert.match(src, /l3_network_thb/)
    assert.match(src, /l1_distinct_count/)
    assert.match(src, /l2_distinct_count/)
    assert.match(src, /l3_distinct_count/)
    assert.match(src, /split_role.*l3_upline/)
  })

  it('JS normalizer includes l3NetworkThb and distinct counts', () => {
    const src = read('lib/referral/build-referral-team-analytics.js')
    assert.match(src, /l3NetworkThb/)
    assert.match(src, /l1DistinctCount/)
    assert.match(src, /l2DistinctCount/)
    assert.match(src, /l3DistinctCount/)
  })

  it('UI: L3 bar shown when total > 0', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /stage133_l3Network/)
    assert.match(src, /tone="violet"/)
  })

  it('UI: 0/100% bug fixed — all pcts 0 when total=0', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /total > 0 \? Math\.round\(\(l1 \/ total\)/)
    assert.match(src, /total > 0 \? Math\.round\(\(l2 \/ total\)/)
    assert.match(src, /total > 0 \? Math\.round\(\(l3 \/ total\)/)
    assert.doesNotMatch(src, /100 - l1Pct/)
  })

  it('UI: tooltips on L1/L2/L3', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /stage133_l1Tooltip/)
    assert.match(src, /stage133_l2Tooltip/)
    assert.match(src, /stage133_l3Tooltip/)
    assert.match(src, /TooltipContent/)
  })

  it('UI: color coding — emerald/blue/violet', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /tone="emerald"/)
    assert.match(src, /tone="blue"/)
    assert.match(src, /tone="violet"/)
    assert.match(src, /bg-emerald-500/)
    assert.match(src, /bg-blue-500/)
    assert.match(src, /bg-violet-500/)
  })

  it('UI: subtitle mentions L3', () => {
    const i18n = read('lib/translations/slices/profile-app-referral.js')
    assert.match(i18n, /stage133_analyticsSubtitle.*L3/)
  })

  it('UI: period shows month name', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /currentMonthLabel/)
    assert.match(src, /stage133_periodMonthYear/)
  })

  it('UI: empty state when total=0', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /stage133_emptyState/)
    assert.match(src, /data-testid="team-analytics-empty"/)
  })

  it('UI: partner counts per level', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /l1Count/)
    assert.match(src, /l2Count/)
    assert.match(src, /l3Count/)
    assert.match(src, /stage133_partnersDirect/)
    assert.match(src, /stage133_partnersInNetwork/)
    assert.match(src, /stage133_partnersInDeep/)
  })

  it('i18n: retention renamed in RU/EN', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    assert.match(src, /stage133_retentionLabel.*Активность партнёров/)
    assert.match(src, /stage133_retentionLabel.*Partner activity/)
    assert.doesNotMatch(src, /stage133_retentionLabel.*"Retention хостов"/)
  })

  it('i18n: L3 keys exist in all 4 languages', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    assert.match(src, /stage133_l3Network.*глубокая сеть/)
    assert.match(src, /stage133_l3Network.*deep network/)
    assert.match(src, /stage133_l3Network.*深度网络/)
    assert.match(src, /stage133_l3Network.*เครือข่ายลึก/)
  })

  it('i18n: period label changed to "This month"', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    assert.match(src, /stage133_periodEarnings.*Этот месяц/)
    assert.match(src, /stage133_periodEarnings.*This month/)
  })
})
