import { SUPPORTED_UI_LOCALE_CODES } from '@/lib/i18n/locale-resolver';

export function normalizePreferredLanguageInput(raw) {
  if (raw === undefined) return { hasValue: false, value: null };
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 12);
  if (!SUPPORTED_UI_LOCALE_CODES.includes(value)) {
    return { hasValue: true, error: 'Unsupported preferred_language' };
  }
  return { hasValue: true, value };
}

export function buildCommonProfileUpdates(body, currentProfile) {
  const updates = {};

  if (body.first_name !== undefined) {
    updates.first_name = String(body.first_name || '').trim().slice(0, 100) || null;
  }
  if (body.firstName !== undefined && body.first_name === undefined) {
    updates.first_name = String(body.firstName || '').trim().slice(0, 100) || null;
  }

  if (body.last_name !== undefined) {
    updates.last_name = String(body.last_name || '').trim().slice(0, 100) || null;
  }
  if (body.lastName !== undefined && body.last_name === undefined) {
    updates.last_name = String(body.lastName || '').trim().slice(0, 100) || null;
  }

  if (body.phone !== undefined) {
    const p = body.phone == null ? null : String(body.phone).trim().slice(0, 50);
    updates.phone = p || null;
  }

  if (body.avatar !== undefined) {
    if (body.avatar === null || body.avatar === '') {
      updates.avatar = null;
    } else {
      const a = String(body.avatar).trim().slice(0, 2048);
      updates.avatar = a || null;
    }
  }

  const incomingPrefs = body.notification_preferences ?? body.notificationPreferences;
  if (incomingPrefs !== undefined && incomingPrefs !== null && typeof incomingPrefs === 'object') {
    const base =
      currentProfile?.notification_preferences && typeof currentProfile.notification_preferences === 'object'
        ? { ...currentProfile.notification_preferences }
        : { email: true, telegram: false, telegramChatId: null };
    updates.notification_preferences = { ...base, ...incomingPrefs };
  }

  const rawPref = body.preferred_language ?? body.preferredLanguage;
  const preferred = normalizePreferredLanguageInput(rawPref);
  if (preferred.error) {
    return { updates: null, error: preferred.error };
  }
  if (preferred.hasValue) {
    updates.preferred_language = preferred.value;
  }

  if (body.instant_booking !== undefined || body.instantBooking !== undefined) {
    const raw = body.instant_booking ?? body.instantBooking
    updates.instant_booking = raw === true
  }

  return { updates, error: null };
}
