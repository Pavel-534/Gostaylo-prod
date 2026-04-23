/**
 * Merges chat + messenger + admin-bulk i18n (`slices/chat-ui.js`) into `uiTranslations`.
 * Imported from `app/messages/layout.js` so the chunk is not required for home / checkout.
 */
import { chatUi } from './slices/chat-ui'
import { uiTranslations, LANGS } from './translation-state'

export function applyChatI18nSlice() {
  for (const l of LANGS) {
    if (chatUi[l]) {
      Object.assign(uiTranslations[l], chatUi[l])
    }
  }
}

applyChatI18nSlice()
