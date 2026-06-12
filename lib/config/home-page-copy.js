/**
 * SSOT: white-label копии главной страницы из env (NEXT_PUBLIC_*).
 * Пустое значение / только пробелы — `null` (UI рендерится без блока).
 * Чтение возможно и на клиенте, и на сервере: NEXT_PUBLIC_* инлайнится Next.js.
 *
 * Спец-токен `AUTO` (case-insensitive) для `NEXT_PUBLIC_HOME_HERO_TITLE` и
 * `NEXT_PUBLIC_HOME_TOP_LISTINGS_TITLE` означает «использовать локализованный
 * перевод через `getUIText`» — заголовок будет автоматически меняться при
 * переключении языка (ru / en / zh / th). Ключ hero: **`homeHeroHeadline`**
 * (`lib/translations/common-ui.js`). Пустой env на клиенте трактуется как AUTO
 * (`use-platform-home-page.js`). Резолвер текста — на клиенте
 * (`PlatformHomeContent.jsx`), потому что только там доступен `useI18n()`.
 *
 * Важно: значения из Vercel иногда копируют с кавычками (`"AUTO"`); `readEnv`
 * их снимает. После добавления env на Vercel нужен **redeploy**, иначе в
 * клиентском бандле останется старое значение `undefined`.
 */

export const HOME_COPY_AUTO_TOKEN = 'AUTO';

/** Fallback для режима AUTO, если `getUIText` вернул пусто или сам ключ (нет строки в словаре). */
export const AUTO_HERO_TITLE_FALLBACK = 'Easy rentals worldwide';

/** Fallback для секции «топ» при AUTO и пустом словаре (white-label EN). */
export const AUTO_TOP_LISTINGS_TITLE_FALLBACK = 'Featured offers';

function stripDecorativeQuotes(s) {
  let t = String(s).trim();
  // NBSP / zero-width / BOM
  t = t.replace(/[\uFEFF\u200B-\u200D]/g, '');
  // Одинарные/двойные кавычки по краям (часто при копипасте из Vercel/Notion)
  t = t.replace(/^['"`«»]+|['"`«»]+$/g, '').trim();
  return t;
}

function readEnv(name) {
  const raw = process.env?.[name];
  if (typeof raw !== 'string') return null;
  const trimmed = stripDecorativeQuotes(raw);
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
 * Если перевод отсутствует (пусто или вернулся сырой ключ `autoKey`) — `autoEmptyFallback`.
 * Пустое env → `null` (вызывающий не рендерит блок).
 *
 * @param {string | null} raw — результат `getHomeHeroTitleRaw()` / `getHomeTopListingsTitleRaw()`.
 * @param {(key: string) => string} resolveAuto — обычно `(k) => getUIText(k, language)`.
 * @param {string} autoKey — ключ перевода для AUTO-режима, напр. `'homeHeroHeadline'`.
 * @param {string | null} [autoEmptyFallback] — строка при пустом/битом переводе (только для AUTO).
 * @returns {string | null}
 */
export function resolveHomeCopy(raw, resolveAuto, autoKey, autoEmptyFallback = null) {
  if (raw == null) return null;
  if (raw === HOME_COPY_AUTO_TOKEN) {
    const fb =
      typeof autoEmptyFallback === 'string' && autoEmptyFallback.trim().length > 0
        ? autoEmptyFallback.trim()
        : null;
    if (typeof resolveAuto !== 'function' || !autoKey) {
      return fb;
    }
    const resolved = resolveAuto(autoKey);
    const s = typeof resolved === 'string' ? resolved.trim() : '';
    const missing = s.length === 0 || s === autoKey;
    if (!missing) return s;
    return fb;
  }
  return raw;
}
