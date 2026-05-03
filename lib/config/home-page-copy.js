/**
 * SSOT: white-label копии главной страницы из env (NEXT_PUBLIC_*).
 * Пустое значение / только пробелы — `null` (UI рендерится без блока).
 * Чтение возможно и на клиенте, и на сервере: NEXT_PUBLIC_* инлайнится Next.js.
 *
 * Спец-токен `AUTO` (case-insensitive) для `NEXT_PUBLIC_HOME_HERO_TITLE` и
 * `NEXT_PUBLIC_HOME_TOP_LISTINGS_TITLE` означает «использовать локализованный
 * перевод через `getUIText`» — заголовок будет автоматически меняться при
 * переключении языка (ru / en / zh / th). Резолвер текста — на клиенте
 * (`PlatformHomeContent.jsx`), потому что только там доступен `useI18n()`.
 */

export const HOME_COPY_AUTO_TOKEN = 'AUTO';

function readEnv(name) {
  const raw = process.env?.[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** «AUTO» (case-insensitive) превращаем в канонический `HOME_COPY_AUTO_TOKEN`. */
function normalizeAutoToken(value) {
  if (typeof value !== 'string') return value;
  return value.toUpperCase() === HOME_COPY_AUTO_TOKEN ? HOME_COPY_AUTO_TOKEN : value;
}

/** Сырой `NEXT_PUBLIC_HOME_HERO_TITLE`: строка / `'AUTO'` / `null`. */
export function getHomeHeroTitleRaw() {
  const v = readEnv('NEXT_PUBLIC_HOME_HERO_TITLE');
  return v ? normalizeAutoToken(v) : null;
}

/** Сырой `NEXT_PUBLIC_HOME_TOP_LISTINGS_TITLE`: строка / `'AUTO'` / `null`. */
export function getHomeTopListingsTitleRaw() {
  const v = readEnv('NEXT_PUBLIC_HOME_TOP_LISTINGS_TITLE');
  return v ? normalizeAutoToken(v) : null;
}

/**
 * Резолвер копии: если значение env = `'AUTO'` — берём из `getUIText(autoKey, language)`.
 * Иначе возвращаем env-строку как есть. Пустое env → `null` (вызывающий не рендерит блок).
 *
 * @param {string | null} raw — результат `getHomeHeroTitleRaw()` / `getHomeTopListingsTitleRaw()`.
 * @param {(key: string) => string} resolveAuto — обычно `(k) => getUIText(k, language)`.
 * @param {string} autoKey — ключ перевода для AUTO-режима, напр. `'heroTitle'`.
 * @returns {string | null}
 */
export function resolveHomeCopy(raw, resolveAuto, autoKey) {
  if (raw == null) return null;
  if (raw === HOME_COPY_AUTO_TOKEN) {
    if (typeof resolveAuto !== 'function' || !autoKey) return null;
    const localized = resolveAuto(autoKey);
    return typeof localized === 'string' && localized.trim().length > 0 ? localized.trim() : null;
  }
  return raw;
}
