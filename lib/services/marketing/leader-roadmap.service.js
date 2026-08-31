/**
 * Stage 202.22 — user-facing roadmap (not dev backlog). No monetary promises in copy.
 */

export const LEADER_ROADMAP = Object.freeze([
  Object.freeze({
    id: 'live_l3',
    i18nKey: 'leaderRoadmap_item1_title',
    descKey: 'leaderRoadmap_item1_desc',
    status: 'coming_soon',
  }),
  Object.freeze({
    id: 'public_leader_page',
    i18nKey: 'leaderRoadmap_item2_title',
    descKey: 'leaderRoadmap_item2_desc',
    status: 'coming_soon',
  }),
  Object.freeze({
    id: 'verified_by_fast_payout',
    i18nKey: 'leaderRoadmap_item3_title',
    descKey: 'leaderRoadmap_item3_desc',
    status: 'locked',
  }),
  Object.freeze({
    id: 'stories_feed',
    i18nKey: 'leaderRoadmap_item4_title',
    descKey: 'leaderRoadmap_item4_desc',
    status: 'coming_soon',
  }),
  Object.freeze({
    id: 'squad_quests',
    i18nKey: 'leaderRoadmap_item5_title',
    descKey: 'leaderRoadmap_item5_desc',
    status: 'locked',
  }),
])

export function getLeaderRoadmapItems() {
  return LEADER_ROADMAP.map((item) => ({ ...item }))
}
