/**
 * Stage 202.36 — reversible referral UI for bank onboarding.
 *
 * Env: NEXT_PUBLIC_REFERRAL_PUBLIC_MODE
 * - unset | `full` — L1+L2+L3 UI, team tab, roadmap, MLM consent (default for dev/prod)
 * - `simple` | `bank` — invite-a-friend only: hide network/L3/team/engagement in public UI
 *
 * Backend accruals unchanged — flip env + redeploy to restore full cabinet.
 */

export const REFERRAL_PUBLIC_MODE_FULL = 'full'
export const REFERRAL_PUBLIC_MODE_SIMPLE = 'simple'

export function getReferralPublicMode() {
  const v = String(process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE || REFERRAL_PUBLIC_MODE_FULL)
    .trim()
    .toLowerCase()
  if (v === REFERRAL_PUBLIC_MODE_SIMPLE || v === 'bank') return REFERRAL_PUBLIC_MODE_SIMPLE
  return REFERRAL_PUBLIC_MODE_FULL
}

export function isSimpleReferralPublicMode() {
  return getReferralPublicMode() === REFERRAL_PUBLIC_MODE_SIMPLE
}
