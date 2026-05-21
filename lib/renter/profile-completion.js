/** SSOT расчёта заполненности профиля арендатора (renter profile page). */

export function calculateProfileCompletion(user) {
  if (!user) return 0
  let score = 0
  if (user.email && String(user.email).trim()) score += 25
  if (user.phone && String(user.phone).trim()) score += 25
  if (user.telegram_id || user.telegram_username) score += 25
  if (user.avatar && String(user.avatar).trim()) score += 25
  return score
}

export function getProfileCompletionItems(user) {
  if (!user) return []
  return [
    {
      id: 'email',
      done: !!(user.email && String(user.email).trim()),
      labelKey: 'profileItemEmail',
      settingsHref: '/renter/settings',
    },
    {
      id: 'phone',
      done: !!(user.phone && String(user.phone).trim()),
      labelKey: 'profileItemPhone',
      settingsHref: '/renter/settings',
    },
    {
      id: 'telegram',
      done: !!(user.telegram_id || user.telegram_username),
      labelKey: 'profileItemTelegram',
      settingsHref: '#telegram-connect',
    },
    {
      id: 'avatar',
      done: !!(user.avatar && String(user.avatar).trim()),
      labelKey: 'profileItemAvatar',
      settingsHref: '/renter/settings',
    },
  ]
}

export function roleUiKey(role) {
  const r = String(role || 'USER').toUpperCase()
  const map = {
    RENTER: 'uiRoleRENTER',
    PARTNER: 'uiRolePARTNER',
    MODERATOR: 'uiRoleMODERATOR',
    ADMIN: 'uiRoleADMIN',
    USER: 'uiRoleUSER',
  }
  return map[r] || 'uiRoleUSER'
}
