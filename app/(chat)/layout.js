import { ChatAppShell } from '@/components/layout/ChatAppShell'
import '@/lib/translations/register-chat-slice'

/** /messages*, push deep links — full chat Realtime stack. */
export default function ChatRouteGroupLayout({ children }) {
  return <ChatAppShell>{children}</ChatAppShell>
}
