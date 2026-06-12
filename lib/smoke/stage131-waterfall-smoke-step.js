/**
 * Stage 131.0 — smoke: ADR-131 reference booking waterfall (35k / 15% guest fee).
 * Strict Mode: asserts match itemized ReferralPolicyService SSOT (ADR131_REFERENCE_TARGETS).
 */
import { getReferralSettings } from '@/lib/services/marketing/referral-calculation.js'
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'
import { policyFromFintechSnapshotConfig } from '@/lib/services/finance/fintech-snapshot.service.js'
import {
  ADR131_REFERENCE_TARGETS,
  ADR131_FX35_REFERENCE_TARGETS,
  adr131LaunchPolicy,
  buildAdr131ReferenceFeeBase,
  computeAdr131ReferenceWaterfall,
  computeAdr131FxReferenceWaterfall,
} from '@/lib/services/finance/fintech-waterfall.js'

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 }
}

function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0)
}

function pass(s, detail, t0) {
  s.ok = true
  s.detail = detail
  markDuration(s, t0)
  return s
}

function fail(s, detail, t0) {
  s.ok = false
  s.detail = String(detail || 'failed').slice(0, 500)
  markDuration(s, t0)
  return s
}

function withinThb(actual, expected, tolerance = 1) {
  const a = Number(actual)
  const e = Number(expected)
  if (!Number.isFinite(a) || !Number.isFinite(e)) return false
  return Math.abs(a - e) <= tolerance
}

/**
 * @returns {Promise<{ ok: boolean, steps: object[] }>}
 */
export async function runStage131WaterfallSmokeStep() {
  const steps = []
  const T = ADR131_REFERENCE_TARGETS
  let t0 = Date.now()

  const sRef = step('131.0 — itemized reference waterfall (35k / 15% / no FX)')
  steps.push(sRef)
  try {
    const policy = adr131LaunchPolicy()
    const { caps, split, netBase } = computeAdr131ReferenceWaterfall(policy)
    const checks = [
      ['adjustedNetThb', netBase.adjustedNetThb, T.adjustedNetThb],
      ['referralPoolThb', caps.referralPoolThb, T.referralPoolThb],
      ['ownerRetainedThb', caps.ownerRetainedThb, T.ownerRetainedThb],
      ['acquiringFeeThb', netBase.acquiringFeeThb, T.acquiringFeeThb],
      ['l1AmountThb', split.l1AmountThb, T.l1AmountThb],
      ['l2AmountThb', split.l2AmountThb, T.l2AmountThb],
      ['refereeAmountThb', split.refereeAmountThb, T.refereeAmountThb],
    ]
    const failed = checks.filter(([label, actual, expected]) => !withinThb(actual, expected))
    if (failed.length) {
      fail(
        sRef,
        failed.map(([label, actual, expected]) => `${label}: ${actual} ≠ ${expected}`).join('; '),
        t0,
      )
    } else {
      pass(
        sRef,
        `adj=${T.adjustedNetThb} pool=${T.referralPoolThb} L1=${T.l1AmountThb} L2=${T.l2AmountThb} guest=${T.refereeAmountThb}`,
        t0,
      )
    }
  } catch (e) {
    fail(sRef, e?.message || e, t0)
  }

  t0 = Date.now()
  const sSnap = step('131.0 — booking fintech_snapshot policy resolution')
  steps.push(sSnap)
  try {
    const policy = adr131LaunchPolicy()
    const snapshotConfig = { ...policy, version: 99 }
    const booking = {
      id: 'smoke-131-snapshot',
      metadata: {
        fintech_snapshot: {
          v: 1,
          captured_at: new Date().toISOString(),
          settings_version: 99,
          config: snapshotConfig,
        },
      },
    }
    const resolved = await getReferralSettings({ booking })
    const snapPolicy = policyFromFintechSnapshotConfig(snapshotConfig)
    const feeBase = buildAdr131ReferenceFeeBase()
    const fromSnap = ReferralPolicyService.deriveSafetyCaps(
      ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, snapPolicy),
      snapPolicy,
    )
    const fromSettings = ReferralPolicyService.deriveSafetyCaps(
      ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, resolved),
      resolved,
    )
    if (
      !withinThb(fromSnap.referralPoolThb, fromSettings.referralPoolThb, 0.01) ||
      resolved.referralReinvestmentPercent !== snapPolicy.referralReinvestmentPercent
    ) {
      fail(
        sSnap,
        `snapshot mismatch pool ${fromSnap.referralPoolThb} vs ${fromSettings.referralPoolThb}`,
        t0,
      )
    } else {
      pass(sSnap, `snapshot pool=${fromSnap.referralPoolThb} THB (locked v99)`, t0)
    }
  } catch (e) {
    fail(sSnap, e?.message || e, t0)
  }

  t0 = Date.now()
  const sFx = step('131.0 — FX 3.5% reference (ADR §8.0.B itemized)')
  steps.push(sFx)
  try {
    const F = ADR131_FX35_REFERENCE_TARGETS
    const { caps, split, netBase } = computeAdr131FxReferenceWaterfall(adr131LaunchPolicy(), 1_360)
    const checks = [
      withinThb(netBase.adjustedNetThb, F.adjustedNetThb),
      withinThb(caps.referralPoolThb, F.referralPoolThb),
      withinThb(split.l1AmountThb, F.l1AmountThb),
      withinThb(split.l2AmountThb, F.l2AmountThb),
      withinThb(split.refereeAmountThb, F.refereeAmountThb),
    ]
    if (checks.every(Boolean)) {
      pass(sFx, `pool=${F.referralPoolThb} L1=${F.l1AmountThb} (FX owner +${F.fxMarkupThb})`, t0)
    } else {
      fail(
        sFx,
        `FX mismatch pool=${caps.referralPoolThb}/${F.referralPoolThb} adj=${netBase.adjustedNetThb}/${F.adjustedNetThb}`,
        t0,
      )
    }
  } catch (e) {
    fail(sFx, e?.message || e, t0)
  }

  t0 = Date.now()
  const sSplit = step('131.0 — pool split sums to pool (±1 THB)')
  steps.push(sSplit)
  try {
    const sum = T.l1AmountThb + T.l2AmountThb + T.refereeAmountThb
    if (withinThb(sum, T.referralPoolThb)) {
      pass(sSplit, `split sum ${sum} = pool ${T.referralPoolThb}`, t0)
    } else {
      fail(sSplit, `split ${sum} ≠ pool ${T.referralPoolThb}`, t0)
    }
  } catch (e) {
    fail(sSplit, e?.message || e, t0)
  }

  t0 = Date.now()
  const sLive = step('131.1 — live ledger split 45/43 (L2 withheld 12%)')
  steps.push(sLive)
  try {
    const launchPolicy = {
      ...normalizeFintechSettingsRow(FINTECH_CONFIG_DEFAULTS),
      ambassadorGuestL2Enabled: false,
      ambassador3WaterfallEnabled: true,
    }
    const live = ReferralPolicyService.resolveLiveGuestPoolPayout(T.referralPoolThb, launchPolicy)
    const checks = [
      withinThb(live.referrerAmountThb, T.l1AmountThb),
      withinThb(live.refereeAmountThb, T.refereeAmountThb),
      withinThb(live.l2WithheldThb, T.l2AmountThb),
      withinThb(live.payablePoolThb, T.l1AmountThb + T.refereeAmountThb),
      live.l2AmountThb === 0,
    ]
    if (checks.every(Boolean)) {
      pass(
        sLive,
        `L1=${live.referrerAmountThb} guest=${live.refereeAmountThb} withheld=${live.l2WithheldThb}`,
        t0,
      )
    } else {
      fail(
        sLive,
        `live split mismatch L1=${live.referrerAmountThb}/${T.l1AmountThb} guest=${live.refereeAmountThb}/${T.refereeAmountThb}`,
        t0,
      )
    }
  } catch (e) {
    fail(sLive, e?.message || e, t0)
  }

  return { ok: steps.every((s) => s.ok), steps }
}

export default { runStage131WaterfallSmokeStep }
