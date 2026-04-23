'use client'

import { ConversationList } from '@/components/chat/ConversationList'
import { INBOX_TAB_TRAVELING } from '@/lib/chat-inbox-tabs'
import { getUIText } from '@/lib/translations'

/**
 * Left column: inbox list for the messenger shell.
 */
export function ConversationSidebar({
  inbox,
  onInboxTabChange,
  conversationId,
  onSelectConversation,
  onArchive,
  archivedHallHref,
  language,
  isPartnerAccount,
}) {
  return (
    <ConversationList
      inbox={{ ...inbox, setInboxTab: onInboxTabChange }}
      selectedId={conversationId}
      onSelect={onSelectConversation}
      showListingName={false}
      showGuestName={inbox.inboxTab === INBOX_TAB_TRAVELING}
      onArchive={onArchive}
      headerActionHref={archivedHallHref}
      headerActionLabel={getUIText('messengerThread_archive', language)}
      language={language}
      roleTabsVisible={isPartnerAccount}
    />
  )
}
