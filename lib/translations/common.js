/**
 * UI translations — common (split by domains)
 */
import { authUi } from './auth.js'
import { bookingUi } from './booking.js'
import { profileUi } from './profile.js'
import { commonCoreUi } from './common-ui.js'

const mergeLang = (lang) => ({
  ...(commonCoreUi[lang] || {}),
  ...(authUi[lang] || {}),
  ...(bookingUi[lang] || {}),
  ...(profileUi[lang] || {}),
})

export const commonUi = {
  ru: mergeLang('ru'),
  en: mergeLang('en'),
  zh: mergeLang('zh'),
  th: mergeLang('th'),
}
