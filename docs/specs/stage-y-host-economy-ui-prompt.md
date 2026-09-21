# Stage Y — Host-side economy UI (deepening 202.33) — Промт для Cursor

**Зачем:** Stage 202.33 создал `HostReferralCard` (компактная карточка «Приведи хозяина» на tab «Ссылка») + `ReferralLegalFootnotes` (collapsible на tab «Заработок»). Этого мало — пользователь не понимает **journey** (что происходит после клика), **конкретный пример** (сколько заработает), и **полный compliance блок** для host-referral.

**Скоуп:** **углубление** существующих компонентов, **НЕ** новые вкладки/колонки. БЕЗ денег/RBAC/SSOT.

---

## Что строим

1. **`HostReferralCard` расширение** — добавить journey timeline + конкретный пример
2. **`HostReferralJourney` (NEW)** — отдельный блок с 3-4 шагами lifecycle, в tab «Ссылка»
3. **`ReferralLegalFootnotes` расширение** — добавить host-specific compliance: disclosure, anti-spam, per-user cap, tax, no-agency
4. **i18n × 4** языка для новых ключей
5. **Tests** — copy regressions + new key coverage

---

## Жёсткие UI-ограничения (не нарушать)

| Ограничение | Причина |
|-------------|--------|
| **0 новых tab'ов** | Уже 5: Обзор, Ссылка, Команда, История, Настройки — хватит |
| **0 новых колонок** в engagement grid | Уже 3: Tier, Quests, Roadmap — не больше |
| **Max 1 новый файл** | `HostReferralJourney.jsx` — отдельный блок |
| **Max 2 расширения** | `HostReferralCard.jsx`, `ReferralLegalFootnotes.jsx` |
| **Всё collapsible** | expandable «Подробнее» если деталей много |
| **Mobile-first** | stack vertical, не horizontal grid |
| **Внутри существующих tab'ов** | «Ссылка» и «Заработок» — новые блоки вставляем туда |

---

## Не делать (явно)

- ❌ Не менять money formulas, RBAC, ledger, SSOT
- ❌ Не делать новых tier-систем
- ❌ Не включать L3 live, public leader page, stories, push
- ❌ Не реализовывать quest claim money (Stage 202.36)
- ❌ Не делать bulk-assign region (admin)
- ❌ Не лезть в Stage 202.21-202.33 (не трогать)
- ❌ Не делать новых API endpoints (только UI/copy)
- ❌ Не менять `referral/me.referralEstimator` (уже расширен в 202.33)

---

## Архитектура

### Новые файлы

```
components/referral/HostReferralJourney.jsx     # NEW: 3-4 шага lifecycle, в tab «Ссылка»
```

### Файлы, которые расширяем (только copy + UI tweak)

```
components/referral/HostReferralCard.jsx            # расширить: journey + пример
components/referral/ReferralLegalFootnotes.jsx      # расширить: host-specific compliance
lib/translations/slices/host-referral-journey.js     # NEW: 4 языка, journey copy
__tests__/stage-y-host-economy-ui.test.js            # 6+ тестов
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/finance/fintech-waterfall.js` (waterfall)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/finance/fintech-insurance.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5 + partner_activation_bonus_thb + mlmLevel1Percent)
- `lib/referral/qualified-host-metrics.js`
- `lib/services/finance/referral-guard.service.js` (`referral_monthly_limit_per_user` = 30/месяц)
- `referral/me.referralEstimator` (read-only endpoint, расширен в 202.33)
- Live data
- ADR-131, ADR-131A

---

## Требования

### 1. `HostReferralCard` расширение (уже создан в 202.33)

**Было (Stage 202.33):**
- Заголовок: «Приведи хозяина»
- Subtitle: «Ваш реферал получит 500 THB на старт. Вы получите 42% от его пула»
- CTA: «Поделиться ссылкой»

**Стало (Stage Y):**
- Добавить **journey** (4 шага) — см. п.2
- Добавить **пример расчёта** (compact calculator preview)
- **Все суммы через `ReferralLedgerAmount` + `referral/me.referralEstimator`**, НЕ хардкод

**НЕ дублировать** `HostReferralJourney.jsx` (это отдельный блок).

### 2. `HostReferralJourney` (NEW)

**Где монтировать:** на tab «Ссылка», **под** `HostReferralCard`. Не в 4-ю колонку engagement grid. Stack vertical.

**Структура (compact timeline):**

```
[1] Поделитесь ссылкой
    Отправьте реферальную ссылку хозяину (другу, коллеге, риелтору)
    ↓
[2] Хозяин регистрируется
    Ваш реферал создаёт объявление по вашей ссылке
    ↓
[3] Активация
    Хост получает бонус на старт из промо-бюджета
    ↓
[4] Вы зарабатываете
    С каждой бронирования вашего хоста — % от реферального пула (L1)
```

**4 языка** через `lib/translations/slices/host-referral-journey.js`:

```js
export const HOST_REFERRAL_JOURNEY = {
  step1Title: { ru: 'Поделитесь ссылкой', en: '...', zh: '...', th: '...' },
  step1Body: { ru: 'Отправьте реферальную ссылку хозяину', en: '...' },
  step2Title: { ru: 'Хозяин регистрируется', ... },
  step2Body: { ru: 'Ваш реферал создаёт объявление по вашей ссылке', ... },
  step3Title: { ru: 'Активация', ... },
  step3Body: { ru: 'Хост получает бонус на старт из промо-бюджета', ... },
  step4Title: { ru: 'Вы зарабатываете', ... },
  step4Body: { ru: 'С каждой бронирования вашего хоста — % от реферального пула (L1)', ... },
}
```

**Visual:** vertical stepper с иконками (lucide: `Share2`, `UserPlus`, `Sparkles`, `Coins`).

**НЕ обещать конкретные суммы в journey** (кроме активации, которая через `partner_activation_bonus_thb` SSOT).

### 3. Пример расчёта (compact, под HostReferralCard)

**НЕ новый калькулятор** — использовать `ReferralCalculatorV2` pattern (уже есть). Просто **пример** для host-side:

```
Пример: ваш хост зарабатывает 5 000 THB/мес
→ Ваш L1: 3 500 THB/мес (70% от его пула)
```

**Суммы через:**
- `referral/me.referralEstimator.mlmLevel1Percent` (70%, host-side MLM)
- НЕ через `networkL1Percent` (42% — это guest pool split, другая ось)
- Пример: 5000 THB × 70% = 3500 THB (но **НЕ обещаем** что весь host-доход = пул)

**Disclaimer в примере:**
```
* Пример расчёта. Реальное вознаграждение зависит от типа бронирования, 
  комиссии платформы и других факторов. Точные суммы — в личном кабинете.
```

### 4. `ReferralLegalFootnotes` расширение (уже создан в 202.33)

**Stage 202.33 создал:** collapsible с per-user cap, tax, no-agency.

**Stage Y добавляет:** host-specific compliance:

1. **Host disclosure (обязательно):**
   ```
   RU: «Я могу получить вознаграждение, когда вы разместите объявление 
        по моей реферальной ссылке»
   EN: «I may receive a reward when you list your place using my referral link»
   ```

2. **Anti-spam (Airbnb-style):**
   ```
   RU: «Делитесь ссылкой только с личными знакомыми. Не публикуйте 
        на форумах, в соцсетях для широкой аудитории, не спамьте»
   EN: «Share your link only with people you know personally. 
        Don't post on public forums, social media for mass reach, or spam»
   ```

3. **No social housing (Airbnb-style):**
   ```
   RU: «Нельзя приглашать хозяев из зданий, где аренда запрещена 
        законом (социальное жильё)»
   EN: «Don't invite hosts from buildings where short-term rental is prohibited 
        (e.g., social housing)»
   ```

4. **No paid promotion (Airbnb-style):**
   ```
   RU: «Нельзя рекламировать реферальную ссылку за плату»
   EN: «Don't advertise your referral link for payment»
   ```

5. **Per-user cap (уже в 202.33, проверить):**
   ```
   RU: «Не более 30 новых приглашений в месяц» (из SSOT `referral_monthly_limit_per_user`)
   ```

**В `lib/translations/slices/referral-disclaimers.js` (уже создан в 202.33):**
- Добавить ключи `hostReferralDisclosure`, `antiSpam`, `noSocialHousing`, `noPaidPromotion`
- 4 языка × 4 ключа = 16 переводов

### 5. Тесты `__tests__/stage-y-host-economy-ui.test.js`

Минимум 6:

1. `HostReferralJourney` отрендерен в tab «Ссылка», **под** `HostReferralCard`
2. Journey имеет 4 шага (step1-step4) с правильными ключами
3. Пример расчёта использует `mlmLevel1Percent` (70%), **НЕ** `networkL1Percent` (42%) — **КРИТИЧНО**
4. `ReferralLegalFootnotes` содержит host disclosure copy (Airbnb-style)
5. `ReferralLegalFootnotes` содержит anti-spam copy
6. `ReferralLegalFootnotes` содержит per-user cap copy (из SSOT)
7. **НЕ** хардкод «500 THB» или «70%» или «42%» в copy — все из API
8. Все 4 языка в `host-referral-journey.js` (no fallback to RU)
9. Existing tests (Stage 202.33) still pass (no regression)

---

## SSOT — не трогать

(см. список выше)

---

## Smoke на prod (после deploy)

1. **Tab «Ссылка»** → `HostReferralCard` (уже было) + `HostReferralJourney` (новое, 4 шага) + пример расчёта
2. **Tab «Заработок»** → `ReferralLegalFootnotes` (уже было + новые host compliance)
3. **Пример расчёта** корректен: `5000 × 70% = 3500` (но НЕ обещаем что это реально)
4. **Host disclosure** присутствует в `ReferralLegalFootnotes`
5. **Anti-spam + no-social + no-paid** присутствуют
6. **i18n:** все 4 языка
7. **Mobile:** stack vertical, не grid
8. **Не сломалось:** Stage 202.21-202.33, Phase A/B FinTech, calculator, leaderboard

---

## Definition of Done

- [ ] `components/referral/HostReferralJourney.jsx` создан, 4 шага, 4 языка
- [ ] `HostReferralCard.jsx` расширен (пример расчёта через `referral/me.referralEstimator`)
- [ ] `ReferralLegalFootnotes.jsx` расширен (host disclosure + anti-spam + no-social + no-paid)
- [ ] `lib/translations/slices/host-referral-journey.js` создан, 4 языка × 4 шага
- [ ] `lib/translations/slices/referral-disclaimers.js` расширен (hostReferralDisclosure, antiSpam, noSocialHousing, noPaidPromotion)
- [ ] **НЕ** хардкод «500 THB» / «70%» / «42%» в copy — все из API
- [ ] 6+ unit-тестов pass
- [ ] НЕ тронуты SSOT, RBAC, ledger, Stage 202.21-202.33
- [ ] **0 новых tab'ов, 0 новых колонок** в engagement grid
- [ ] **Max 1 новый файл** + 2 расширения
- [ ] Git commit: `Stage Y — Host-side economy UI (journey + example + compliance)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage Y
2. **Smoke** на dev (8 пунктов) + на prod
3. **Параллельно оффлайн:** trademark, домены, медиа-контакты

**Дальше (по приоритету):**
1. **Stage 202.32 (e2e smoke integration)** — рекомендованный Cursor, валидирует что 11+ этапов работают вместе
2. **Stage 202.34 (fraud/emergency audit)** — после e2e
3. **Stage Z (tier disambiguation redesign)** — 3-5 дней, 4 tier-системы на одной странице с явным разведением
4. **ADR-300 audit** — когда Pavel скажет
5. **Media demo** — когда YooKassa подключит

---

**Конец промта.** Скопируй и отправь в Cursor. Это **только UI/copy**, **углубление** Stage 202.33. Если Cursor уточняет — отвечай на основе `lib/translations/` структуры, `ReferralCalculatorV2` (пример pattern), `lucide` (иконки), `referral/me.referralEstimator` (read-only API, **НЕ** менять). **Не изобретай** новые вкладки, **не дублируй** Stage 202.33 компоненты, **не хардкодь** проценты.
