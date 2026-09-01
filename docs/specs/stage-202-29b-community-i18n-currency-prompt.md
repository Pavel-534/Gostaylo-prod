# Stage 202.29b — Community i18n currency polish (P1/P2 follow-up 202.26) — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) нашёл 3 P1 в i18n оси:
1. **THB literal в community i18n** — `localLeaderTier_missing_earned`, `leaderQuests_disclaimer` содержат литерал **«THB»** во всех 4 языках, не валюта шапки. В Таиланде это нормально, в РФ и СНГ должен быть `₽` или другая валюта шапки.
2. **Hardcoded RU в `ReferralProfileTabSettings.jsx:106,151`** — toast/Label без `t()`, в RU работает, в EN/TH/ZH — fallback.
3. **Admin user detail page** — почти весь UI на русском литералами (P1, **out of scope** для 202.29b).

Stage 202.22 (Local Leader Tier + Quests + Roadmap) использовал `ReferralLedgerAmount` для UI display, **но** в i18n строках остался hardcoded «THB». Это inconsistency между UI и copy.

**Скоуп:** ТОЛЬКО community i18n strings + ProfileTabSettings.jsx. БЕЗ изменений Stage 202.22/202.26 логики, БЕЗ money/RBAC/SSOT.

**Note:** номер этапа `202.29b` потому что `202.29` уже занят другим Stage (Pavel делал там правки с Cursor). Используем `202.29b` чтобы не путать.

---

## Что строим

1. **Display currency token** — заменить hardcoded «THB» на `{currency}` placeholder в community i18n
2. **Format helper** — `formatCommunityCurrency(amount, currency)` через `ReferralLedgerAmount` / `formatThbAsDisplay`
3. **i18n updates × 4 языка** — все community строки используют `{currency}` token
4. **ReferralProfileTabSettings.jsx** — убрать hardcoded RU, заменить на `t()`
5. **Тесты** — THB literal отсутствует, display currency правильный

---

## Не делать (явно)

- ❌ Не менять Stage 202.22 (LocalLeaderTier, QuestsBlock, TierRoadmap) логику — только i18n strings + display
- ❌ Не менять Stage 202.26 (partner-metrics-glossary.js) — другая ось
- ❌ Не менять money formulas, RBAC, ledger
- ❌ Не делать admin user page (P1, отдельный этап)
- ❌ Не делать ReferralAmbassadorLevels (публичный лендинг, не community)
- ❌ Не вводить новые currency tokens (использовать существующий display formatter)
- ❌ Не менять SSOT-файлы

---

## Архитектура

### Файлы, которые трогаем

```
lib/translations/slices/local-leader-tier.js                 # THB → {currency} token
lib/translations/slices/leader-quests.js                     # THB → {currency} token
components/referral/LocalLeaderTier.jsx                      # использовать formatCommunityCurrency
components/referral/QuestsBlock.jsx                          # использовать formatCommunityCurrency
components/referral/ReferralProfileTabSettings.jsx          # убрать hardcoded RU
__tests__/stage-202-29b-community-i18n-currency.test.js      # 6+ тестов
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/finance/fintech-waterfall.js` (waterfall formula)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- `lib/referral/qualified-host-metrics.js` (Stage 202.22/202.27/202.27b)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. `formatCommunityCurrency` helper (использовать существующий)

**Сначала** grep'ни существующие display formatters:
- `lib/referral/ReferralLedgerAmount.jsx` — компонент
- `lib/format/formatThbAsDisplay.js` (если есть) или аналог
- `lib/i18n/get-guest-provider-label.js` — НЕ SSOT для currency

**Использовать существующий** `formatThbAsDisplay` или `ReferralLedgerAmount` для community UI. **Не изобретать** новый formatter.

**Если** нужен helper для `{currency}` placeholder — создать `lib/format/formatCommunityCurrency.js` (тонкая обёртка):

```js
import { formatThbAsDisplay } from '@/lib/format/formatThbAsDisplay'

/**
 * Stage 202.29b — community i18n currency token.
 * Использует существующий display formatter.
 */
export function formatCommunityCurrency(amountThb, locale, currency) {
  // currency: 'THB' | 'RUB' | 'USD' (из шапки)
  // Возвращает строку типа "₽1 234", "฿1 234", "$32"
  return formatThbAsDisplay(amountThb, locale, currency)
}
```

### 2. `lib/translations/slices/local-leader-tier.js` — заменить THB

**Текущее (по audit):**
```js
// i18n ключи содержат литерал THB
'localLeaderTier_missing_earned': 'Не хватает {n} THB до следующего уровня',
'localLeaderTier_missing_hosts': 'Пригласи {n} активных партнёров',
'localLeaderTier_missing_bookings': 'Проведи {n} бронирований как партнёр',
```

**Нужно:** использовать `{currency}` placeholder:

```js
'localLeaderTier_missing_earned': 'Не хватает {amount} {currency} до следующего уровня',
// или вариант с "до":
'localLeaderTier_missing_earned_to': 'До следующего уровня: {amount} {currency}',
```

**Аналогично для всех 4 языков** (RU/EN/ZH/TH). Display currency подставляется в компоненте:

```jsx
// LocalLeaderTier.jsx
<span>{t('localLeaderTier_missing_earned', { 
  amount: formatCommunityCurrency(missing.earnedThb, locale, currency),
  currency: getCurrencyLabel(locale),  // 'THB' | '₽' | '$'
})}</span>
```

### 3. `lib/translations/slices/leader-quests.js` — disclaimer

**Текущее (по audit):**
```js
'leaderQuests_disclaimer': 'Награда начисляется из промо-бюджета, не из пула реферальной программы. Максимум 100 THB за квест.',
```

**Нужно:** `100` остаётся как число (cap), `THB` → `{currency}`:

```js
'leaderQuests_disclaimer': 'Награда начисляется из промо-бюджета, не из пула реферальной программы. Максимум {cap} {currency} за квест.',
// usage: t('leaderQuests_disclaimer', { cap: 100, currency: '฿' })
```

**И quest titles с `{amount}` reward** (если есть):
```js
'leaderQuests_quest1_title': 'Первый приглашённый друг (+{amount} {currency})',
// usage: t('leaderQuests_quest1_title', { amount: 50, currency: '฿' })
```

### 4. `components/referral/LocalLeaderTier.jsx` — использовать formatCommunityCurrency

**Было:**
```jsx
{missing.earnedThb > 0 && (
  <li>• {t('localLeaderTier_missing_earned', { n: missing.earnedThb })}</li>
)}
```

**Стало:**
```jsx
import { formatCommunityCurrency } from '@/lib/format/formatCommunityCurrency'
import { useI18n } from '@/contexts/i18n-context'

const { language } = useI18n()
const displayCurrency = getCurrencyLabel(language)  // 'THB' | '₽' | '$'

{missing.earnedThb > 0 && (
  <li>• {t('localLeaderTier_missing_earned', { 
    amount: formatCommunityCurrency(missing.earnedThb, language, displayCurrency),
    currency: displayCurrency,
  })}</li>
)}
```

**Сначала** проверь, как `ReferralLedgerAmount` уже получает currency (через context, prop, или i18n). Следуй тому же паттерну.

### 5. `components/referral/QuestsBlock.jsx` — disclaimer с placeholder

**Было:**
```jsx
<p className="mt-3 text-xs text-slate-500">
  {t('leaderQuests_disclaimer')}
</p>
```

**Стало:**
```jsx
<p className="mt-3 text-xs text-slate-500">
  {t('leaderQuests_disclaimer', { 
    cap: 100, 
    currency: displayCurrency,
  })}
</p>
```

### 6. `components/referral/ReferralProfileTabSettings.jsx` — убрать hardcoded RU

**Audit нашёл** строки 106, 151 с hardcoded русским. **Найти и заменить:**

```jsx
// Было (примерно):
toast.success('Настройки сохранены')

// Стало:
toast.success(t('referralSettings_saveSuccess'))
```

**Сначала** grep'ни `ReferralProfileTabSettings.jsx`:
```bash
rg -n "[А-Яа-яЁё]" components/referral/ReferralProfileTabSettings.jsx
```

Найти все строки с кириллицей, добавить в `lib/translations/slices/referral-profile-tab-settings.js` (NEW слайс) или существующий слайс, подключить.

### 7. Тесты `__tests__/stage-202-29b-community-i18n-currency.test.js`

Минимум 6:

1. `local-leader-tier.js` НЕ содержит литерал «THB» во всех 4 языках (grep-style test)
2. `leader-quests.js` НЕ содержит литерал «THB» во всех 4 языках
3. `leaderQuests_disclaimer` принимает `{cap}` и `{currency}` placeholders
4. `formatCommunityCurrency(1000, 'ru', 'RUB')` → строка типа «₽1 000»
5. `formatCommunityCurrency(1000, 'th', 'THB')` → строка типа «฿1,000»
6. `ReferralProfileTabSettings.jsx` НЕ содержит hardcoded кириллицу (grep test)
7. Existing Stage 202.22/202.26 tests still pass (no regression)

---

## SSOT — не трогать

(см. список выше)

---

## Smoke на prod (после deploy)

1. **`/profile/referral`** (RU locale): community блок показывает «₽» или «THB» в зависимости от шапки, **не hardcoded THB**
2. **TH locale:** «฿» (THB)
3. **EN locale:** «THB» (или «$» если выбрано)
4. **`ReferralProfileTabSettings`** в EN/TH/ZH: toast/label не на русском
5. **Quests disclaimer** показывает `{currency}` правильно во всех 4 языках
6. **Не сломалось:** Stage 202.21-202.27b, Phase A/B FinTech, calculator, leaderboard
7. **i18n completeness:** `npm run check:i18n` — pass (если есть)

---

## Definition of Done

- [ ] `lib/translations/slices/local-leader-tier.js` — все 4 языка без «THB» литерала, используют `{currency}`
- [ ] `lib/translations/slices/leader-quests.js` — все 4 языка без «THB» литерала, используют `{currency}`
- [ ] `LocalLeaderTier.jsx` использует `formatCommunityCurrency` для missing.earnedThb
- [ ] `QuestsBlock.jsx` использует `{currency}` в disclaimer и quest titles
- [ ] `ReferralProfileTabSettings.jsx` — нет hardcoded кириллицы
- [ ] 6+ unit-тестов pass
- [ ] НЕ тронуты SSOT-сервисы, RBAC, ledger, Stage 202.22/202.26 логика
- [ ] НЕ сломан Stage 202.22/202.26/202.27/202.27b
- [ ] НЕ сделан admin user page (P1, отдельный этап)
- [ ] Git commit: `Stage 202.29b — Community i18n currency polish (THB literals + ProfileTabSettings RU fix)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.29b
2. **Smoke** на dev (7 пунктов) + на prod
3. **Связаться с медиаперсонами** (когда YooKassa)
4. **Trademark / домены** (Diana, spaceship.com)
5. **Затем — финальный audit рефералки** (как Pavel упомянул "после готовности её нужно будет ещё проаудировать")

**Дальше:**
- Финальный audit рефералки (post-202.29b) — отдельный промт
- ADR-300 audit (Pavel упомянул) — отдельный промт
- `me/rank` perf — отдельный этап, не горит

---

**Конец промта.** Скопируй и отправь в Cursor. Это **i18n polish + i18n fix**, read-only. Если Cursor уточняет — отвечай на основе существующих display formatter'ов (`formatThbAsDisplay`, `ReferralLedgerAmount`), **не изобретай** новые currency helpers.
