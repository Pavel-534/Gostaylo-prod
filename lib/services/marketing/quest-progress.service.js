/**
 * Stage 202.22 — read-only quest progress (Promo Tank rewards — accrual in a later stage).
 * Max reward per quest: 100 THB (display only until claim flow exists).
 */

export const LEADER_QUESTS = Object.freeze([
  Object.freeze({
    id: 'first_invite',
    i18nKey: 'leaderQuests_quest1_title',
    rewardThb: 50,
    check: ({ directInvitesCount }) => Number(directInvitesCount) >= 1,
  }),
  Object.freeze({
    id: 'first_booking',
    i18nKey: 'leaderQuests_quest2_title',
    rewardThb: 100,
    check: ({ bookingsViaRefCount }) => Number(bookingsViaRefCount) >= 1,
  }),
  Object.freeze({
    id: 'three_hosts_30d',
    i18nKey: 'leaderQuests_quest3_title',
    rewardThb: 100,
    check: ({ qualifiedHostsLast30d }) => Number(qualifiedHostsLast30d) >= 3,
  }),
  Object.freeze({
    id: 'first_completed_host',
    i18nKey: 'leaderQuests_quest4_title',
    rewardThb: 100,
    check: ({ completedBookingsAsHost }) => Number(completedBookingsAsHost) >= 1,
  }),
])

export const LEADER_QUEST_MAX_REWARD_THB = 100

/**
 * @param {Record<string, number | boolean>} metrics
 */
export function computeQuestsProgress(metrics) {
  return LEADER_QUESTS.map((q) => {
    const conditionMet = q.check(metrics)
    return {
      id: q.id,
      titleKey: q.i18nKey,
      rewardThb: q.rewardThb,
      /** Condition satisfied — payout/claim is a separate future flow. */
      conditionMet,
      status: conditionMet ? 'condition_met' : 'in_progress',
    }
  })
}
