/**
 * Chat + messenger i18n — `(chat)` route group only (Stage 171.31).
 * @see app/(chat)/messages/layout.js
 */
import { chatUi } from './slices/chat-ui'
import { applyI18nSlices } from './apply-i18n-slices'

export function applyChatI18nSlice() {
  applyI18nSlices(chatUi)
}

applyChatI18nSlice()
