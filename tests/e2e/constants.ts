/**
 * Единые E2E-константы (Playwright): env + дефолты + тестовые селекторы/роуты.
 */

const DEFAULTS = {
  adminEmail: 'pavel_534@mail.ru',
  partnerEmail: '86boa@mail.ru',
  renterEmail: 'pavel29031983@gmail.com',
  password: 'az123456',
} as const

const trim = (v: string | undefined | null) => String(v || '').trim()

export const E2E_EMAILS = {
  admin: trim(process.env.E2E_ADMIN_EMAIL) || DEFAULTS.adminEmail,
  partner: trim(process.env.E2E_PARTNER_EMAIL) || DEFAULTS.partnerEmail,
  renter: trim(process.env.E2E_RENTER_EMAIL) || DEFAULTS.renterEmail,
} as const

export const E2E_PASSWORD = trim(process.env.E2E_PASSWORD) || DEFAULTS.password
export const E2E_FIXTURE_SECRET = trim(process.env.E2E_FIXTURE_SECRET)

export const E2E_ROUTES = {
  pendingChatBookingFixture: '/api/v2/internal/e2e/pending-chat-booking',
  tourBookingMathFixture: '/api/v2/internal/e2e/tour-booking-math',
  authMe: '/api/v2/auth/me',
  authLogin: '/api/v2/auth/login',
  chatConversations: '/api/v2/chat/conversations',
  chatMessages: '/api/v2/chat/messages',
} as const

export const E2E_HEADERS = {
  fixtureSecretHeader: 'x-e2e-fixture-secret',
  jsonContentType: 'application/json',
} as const

export const E2E_TEST_IDS = {
  chatComposerTextarea: 'chat-composer-textarea',
  chatMilestoneCard: 'chat-milestone-card',
  chatActionConfirm: 'chat-action-confirm',
  chatActionDecline: 'chat-action-decline',
  chatThreadScroll: 'chat-thread-scroll',
  currencySelector: 'currency-selector',
  bookingContactHost: 'booking-contact-host',
} as const

export const E2E_STRINGS = {
  bikeTitleRegex: /pcx|honda/i,
  toursSlug: 'tours',
  bikeCategory: 'vehicles',
} as const

