# Stage 202.15 — Cookie consent (GDPR / 152-ФЗ) — Промт для Cursor

**Зачем:** в коде нет cookie-consent баннера. PostHog + локальные user-state cookies ставятся без явного согласия. Юр.риск в ЕС (GDPR) и РФ (152-ФЗ): штраф до 500K ₽ в РФ, до 4% оборота в ЕС.

**Связанные документы:**
- `docs/audits/stage-security-IDOR-email-2026-08-27.md` (раздел "Cookie consent / GDPR / 152-ФЗ")
- `docs/ADR/163-coordinate-privacy-ssot.md` (style precedent для privacy)
- `components/analytics/ProductAnalyticsInit.jsx`
- `lib/analytics/product-analytics.js`
- `app/(marketing)/legal/privacy/page.js`

**Скоуп:** cookie-consent UI + server-side gate для аналитики/маркетинговых cookies + i18n RU/EN/ZH/TH. Без редизайна footer / без новой legal-страницы (она уже есть).

---

## Что строим

1. **CookieConsent-компонент** — маленький баннер внизу страницы (mobile-first), 2 кнопки: «Только необходимые» / «Принять все». Ссылка «Подробнее» → `/legal/privacy`.
2. **Server-side gate** для PostHog и любых cookies, требующих consent. До выбора пользователя — никаких сторонних трекеров.
3. **localStorage-флаг** `airento_cookie_consent` с версией решения (для re-prompt при изменении политики).
4. **i18n на 4 языка** (RU/EN/ZH/TH) — единый SSOT в `lib/translations/`.

---

## Не делать (явно)

- ❌ Не трогать HTTP-only cookies (`gostaylo_session`, `gostaylo_csrf`, geo-cookies) — они функциональные, consent не нужен.
- ❌ Не трогать `gostaylo_user` (localStorage) — это UI cache для `getCurrentUser()`, не third-party tracking. **Можно оставить как есть.**
- ❌ Не переписывать `/legal/privacy` — страница уже есть.
- ❌ Не менять PostHog events / API — только gate на init.
- ❌ Не делать cookie wall / modal-on-every-page — только первый визит, потом невидимо.
- ❌ Не использовать cookie-cmp-библиотеки (CookieBot, OneTrust и т.д.) — overengineering для текущего масштаба.

---

## Архитектура

### Новые файлы

```
lib/consent/
  cookie-consent-state.js     # SSOT для чтения/записи решения (browser only)
  cookie-consent-config.js    # Версии политики, default'ы, типы consent

components/
  CookieConsent.jsx           # UI баннер (client component, 'use client')

lib/translations/slices/
  cookie-consent.js           # i18n ключи × 4 языка (RU/EN/ZH/TH)
```

### Изменения

```
lib/analytics/product-analytics.js    # gate PostHog init на consent
components/analytics/ProductAnalyticsInit.jsx    # ничего, кроме re-export gate helper
app/(marketing)/layout.jsx или root layout     # <CookieConsent /> в конце body
```

---

## Требования

### 1. `lib/consent/cookie-consent-state.js`

```js
// SSOT чтения/записи решения. Browser-only (guard 'typeof window').
//
// Версионирование: 'airento_cookie_consent' v1 — набор значений { necessary, all }
//   { necessary: true, all: false, version: 1, at: 'ISO', method: 'banner' | 'auto_reject' }
//   { necessary: true, all: true,  version: 1, at: 'ISO', method: 'banner' }
//   { necessary: true, all: false, version: 1, at: 'ISO', method: 'auto_reject' } — no JS
//
// Re-prompt: если stored.version < currentVersion → баннер снова виден.
```

API:
- `getStoredConsent()` → `{ necessary, all, version, at, method } | null`
- `setStoredConsent({ all: boolean, method: 'banner' })` → void
- `clearStoredConsent()` (для тестов / settings)
- `getCurrentPolicyVersion()` → number (SSOT)
- `shouldShowBanner()` → boolean (no consent OR version mismatch)
- `hasAnalyticsConsent()` → boolean (используется в product-analytics.js)

`localStorage` key: `airento_cookie_consent`. JSON-serialised, defensive `try/catch`.

### 2. `lib/consent/cookie-consent-config.js`

```js
// Текущая версия политики. Bump = re-prompt всех юзеров.
export const COOKIE_CONSENT_POLICY_VERSION = 1

// Категории cookies. Пока только две:
//   - necessary: всегда true (HTTP-only, functional, security)
//   - analytics: PostHog, воронки, page_view events
// В будущем можно добавить 'marketing', но сейчас не нужно.
export const CONSENT_CATEGORIES = {
  necessary: true,    // всегда true, нельзя отключить
  analytics: false,   // default off до явного согласия
}
```

### 3. `components/CookieConsent.jsx`

Минимальный функционал:
- `useEffect` на mount: `shouldShowBanner()` → если true, показать; иначе `null`
- 2 кнопки:
  - **«Только необходимые»** → `setStoredConsent({ all: false })` + закрыть
  - **«Принять все»** → `setStoredConsent({ all: true })` + закрыть
- Третья ссылка: **«Политика конфиденциальности»** → `href="/legal/privacy"` (target="_blank" опционально)
- i18n: 4 ключа (см. ниже)
- Без анимаций / без иконок-эмодзи / без звуков / без cookie wall

Стиль:
- `fixed bottom-0 left-0 right-0` (mobile-first)
- z-index: high (поверх контента, но не выше toast'ов)
- Backdrop: тонкая тень + bg-white/dark:bg-neutral-900
- Кнопки: используй `components/ui/button.jsx` (там есть Tailwind variants) — primary / secondary / outline
- Закругление: `rounded-t-xl` только сверху, на мобиле — full width
- Padding: `p-4 sm:p-6`
- Text size: `text-sm sm:text-base`

Доступность:
- `role="dialog"`, `aria-labelledby="cookie-consent-title"`, `aria-describedby="cookie-consent-body"`
- `<button>` с visible focus ring (не убирай `focus-visible:ring-2`)
- `prefers-reduced-motion` — без анимаций появления
- Keyboard: tab focus order natural; escape не закрывает (обязательно явный выбор)

### 4. `lib/analytics/product-analytics.js` — gate PostHog

В функции `getPosthog()` (строка 36-56) добавить проверку consent:

```js
async function getPosthog() {
  if (!analyticsEnabled()) return null
  if (typeof window === 'undefined') return null  // уже есть
  
  // NEW: gate на consent
  const { hasAnalyticsConsent } = await import('@/lib/consent/cookie-consent-state')
  if (!hasAnalyticsConsent()) return null
  
  // ... остальное без изменений
}
```

Также добавить хелпер для уже инициализированного PostHog: `getPosthogSafe()` или просто проверка в `trackProductEvent` — если PostHog не init, события не шлём (это уже работает через `appendAnalyticsTap`, но PostHog-сам не отправит).

### 5. Root layout integration

Найти root layout (`app/layout.jsx` или `app/(marketing)/layout.jsx`) и добавить `<CookieConsent />` рядом с другими глобальными компонентами (Toast, ProductAnalyticsInit и т.д.).

---

## i18n — `lib/translations/slices/cookie-consent.js`

Структура: посмотри `lib/translations/slices/profile-app-referral.js` как reference (там точно такая же схема namespace → 4 языка).

Ключи (одни и те же 4 языка, по 4 строки на ключ):

| key | RU | EN | ZH | TH |
|-----|----|----|----|----|
| `cookie_consent_title` | Файлы cookie | Cookies | Cookie | คุกกี้ |
| `cookie_consent_body` | Мы используем cookie для работы сайта и аналитики. Аналитические cookie помогают нам улучшать сервис. Выберите, что разрешить. | We use cookies to run the site and for analytics. Analytics cookies help us improve. Choose what to allow. | 我们使用 Cookie 运行网站并进行统计分析。分析 Cookie 有助于我们改进服务。 | เราใช้คุกกี้เพื่อให้เว็บไซต์ทำงานและวิเคราะห์ข้อมูล คุกกี้วิเคราะห์ช่วยพัฒนาบริการ |
| `cookie_consent_reject` | Только необходимые | Only necessary | 仅必要 | เฉพาะที่จำเป็น |
| `cookie_consent_accept` | Принять все | Accept all | รับทั้งหมด | ยอมรับทั้งหมด |
| `cookie_consent_policy_link` | Политика конфиденциальности | Privacy Policy | 隐私政策 | นโยบายความเป็นส่วนตัว |
| `cookie_consent_aria_label` | Диалог согласия на cookie | Cookie consent dialog | Cookie 同意对话框 | กล่องโต้ตอบความยินยอมคุกกี้ |

5 ключей × 4 языка = 20 строк. Всё.

---

## UX-сценарии

1. **Первый визит, JS on** → баннер появляется снизу через 0.5s delay (чтобы не мельтешил сразу). 2 кнопки + ссылка.
2. **Первый визит, JS off** → PostHog не работает (нужен JS), другие cookies functional → баннер не покажется, но `appendAnalyticsTap` тоже не сработает. **OK**, мы graceful-degrade.
3. **После выбора «Только необходимые»** → баннер исчезает, localStorage записан, PostHog не init. Перезагрузка → баннер не появляется.
4. **После выбора «Принять все»** → баннер исчезает, PostHog init на следующем render. Перезагрузка → баннер не появляется.
5. **Bump `COOKIE_CONSENT_POLICY_VERSION` до 2** → все юзеры снова видят баннер (потому что stored.version < 2). Это re-prompt при смене политики.
6. **localStorage очищен вручную** → баннер снова появляется.
7. **Mobile** → баннер full-width, кнопки stack vertical, читаемый.
8. **Page navigation** → баннер НЕ появляется на каждой странице. Один раз на сессию выбора.

---

## Тесты (обязательно)

Минимум 6 unit-тестов в `__tests__/stage202-15-cookie-consent.test.js`:

1. `getStoredConsent` returns null when localStorage empty
2. `setStoredConsent({all: true})` + `hasAnalyticsConsent()` → true
3. `setStoredConsent({all: false})` + `hasAnalyticsConsent()` → false
4. `shouldShowBanner()` returns true on first visit, false after decision
5. Bumping `COOKIE_CONSENT_POLICY_VERSION` triggers re-prompt
6. `clearStoredConsent` resets state

E2E (если не лень, 1-2 теста в `tests/e2e/`):
- Banner appears on first visit, disappears after click "Accept all"
- PostHog events do NOT fire without consent (intercept /us.i.posthog.com)

Ручная проверка на локалке (обязательно перед PR):
1. `npm run dev`, открой `localhost:3000` в инкогнито → баннер виден
2. Click «Только необходимые» → баннер исчез, в DevTools → Application → Local Storage → `airento_cookie_consent` есть с `all: false`
3. Открой DevTools → Network → отфильтруй `posthog` → нет запросов
4. Перезагрузи → баннер НЕ появляется
5. Hard reload с очищенным localStorage → баннер снова
6. Mobile viewport (DevTools responsive 375px) → баннер корректно сжат

---

## Smoke на prod (после деплоя)

1. Открой `https://airento.ru` в инкогнито → баннер виден
2. Accept all → в Network нет 400 от PostHog init
3. Перейди на 2-3 страницы → page_view события НЕ шлются (без consent)
4. localStorage → `airento_cookie_consent` с `version: 1`
5. `https://airento.ru/legal/privacy` — рендерится (это destination из баннера)

---

## Definition of Done

- [ ] Все 4 файла созданы (`cookie-consent-state.js`, `cookie-consent-config.js`, `CookieConsent.jsx`, `cookie-consent.js` translation slice)
- [ ] PostHog gated на consent (`product-analytics.js` патчен)
- [ ] `<CookieConsent />` в root layout
- [ ] i18n: 6 ключей × 4 языка в translation slice, проверено что тексты не длиннее 60 символов для mobile
- [ ] Тесты 6/6 (или 8/8 если добавишь e2e)
- [ ] Manual smoke на dev + prod (см. выше) — pass
- [ ] НЕ тронуты: HTTP-only cookies, `gostaylo_user` localStorage, footer, `/legal/privacy` страница, PostHog events/API
- [ ] НЕ использованы: cookie-cmp-библиотеки (CookieBot, OneTrust, и т.д.), анимации slide-in, иконки-эмодзи
- [ ] Git commit message: `Stage 202.15 — cookie consent (GDPR/152-ФЗ)`

---

## После мержа (Pavel делает)

1. **Коммит + пуш** в `Gostaylo-prod`
2. **Скинуть мне** ссылку на коммит — я обновлю `docs/audits/stage-security-IDOR-email-2026-08-27.md` (раздел "Cookie consent" → из FAIL в PASS)
3. **Optional**: зарегать домен в Google Postmaster (в фоне, не срочно)

---

## Документация (обязательно обновить)

- `docs/TECHNICAL_MANIFESTO.md` — раздел "Свежие дельты": добавить запись про Stage 202.15
- `docs/HISTORY.md` — добавить запись про Stage 202.15
- `docs/SYSTEM_MAP.md` — если есть раздел "Analytics / Tracking" — упомянуть consent gate
- НЕ трогать: `docs/CONSTITUTION.md`, `ARCHITECTURAL_DECISIONS.md` (consent — это не конституционный уровень, не нужны ADR)

---

**Конец промта.** Скопируй блок ниже, отправь в Cursor.
