'use client'

/**
 * Thread-scoped SSoT for /messages/[id] — current conversation, messages, participants.
 * (Global inbox badge / list sync remains in @/lib/context/ChatContext.jsx)
 */
import { createContext, useContext } from 'react'

const MessengerThreadContext = createContext(null)

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ContextType<typeof MessengerThreadContext>|null} props.value
 */
export function MessengerThreadProvider({ children, value }) {
  return (
    <MessengerThreadContext.Provider value={value}>{children}</MessengerThreadContext.Provider>
  )
}

export function useMessengerThread() {
  const v = useContext(MessengerThreadContext)
  if (v == null) {
    throw new Error('useMessengerThread must be used within MessengerThreadProvider')
  }
  return v
}

/** For optional consumers (e.g. devtools); returns null outside provider. */
export function useMessengerThreadOptional() {
  return useContext(MessengerThreadContext)
}
