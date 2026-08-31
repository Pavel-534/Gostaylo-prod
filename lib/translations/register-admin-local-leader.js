import { applyI18nSlices } from './apply-i18n-slices'
import { adminLocalLeaderUi } from './slices/admin-local-leader'
import { leaderRegionsUi } from './slices/leader-regions'
import { LANGS } from './translation-state'

const sliceByLang = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    {
      ...(adminLocalLeaderUi[lang] || {}),
      ...(leaderRegionsUi[lang] || {}),
    },
  ]),
)

export function applyAdminLocalLeaderI18nSlice() {
  applyI18nSlices(sliceByLang)
}

applyAdminLocalLeaderI18nSlice()

