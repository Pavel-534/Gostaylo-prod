# Stage 202.26 — Partner Metrics Glossary + UI Disambiguation — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) нашёл **P1 "Dual partner metrics"** — в продукте есть **два разных счётчика «партнёров»**:
- **Withdraw tiers** (Beginner/Pro/Ambassador 60/75/85%) — `ReferralTierSyncService.countDirectPartnersInvited` → `role === PARTNER`
- **Network L1/L2/L3** (split pool 42/10/5/43) — тоже `countDirectPartnersInvited`
- **Community 5 levels** (Участник → Лидер региона) — `qualified-host-metrics.js` → **qualified hosts** (L1 invite + activation или COMPLETED as partner)

Пользователь видит «10 партнёров» в одном месте и «3 партнёра» в другом — выглядит как баг, не как два разных счётчика. **Это размывает нашу уникальную 3-осевую модель**, что мы сами в audit пометили как **medium risk**.

**Скоуп:** ТОЛЬКО copy + UI disambiguation. БЕЗ изменения определений, порогов, формул, RBAC. БЕЗ денег. БЕЗ новых tier-систем.

---

## Что строим

1. **Glossary** (глоссарий терминов) — один источник правды про «как мы считаем партнёров» в 3 разных осях
2. **UI disambiguation** — каждый показ числа «партнёров» имеет tooltip/hint с пояснением, какая именно ось
3. **Helper copy** в 4 языках — заменить «хост/бронь» на агрегаторскую лексику «заказ/клиент» (где уместно)
4. **Subtitle consistency** — все 3 tier-системы в profile явно отделяются подзаголовком

---

## Не делать (явно)

- ❌ Не менять определения (PARTNER role, qualified host, network depth) — это в SSOT
- ❌ Не менять пороги tier'ов (10 партнёров, 5 хостов, и т.д.)
- ❌ Не вводить новые tier-системы
- ❌ Не менять money formulas
- ❌ Не менять RBAC
- ❌ Не менять ledger
- ❌ Не лезть в `lib/services/finance/*` (SSOT)
- ❌ Не удалять существующие компоненты — только добавлять tooltip/disambiguation
- ❌ Не делать рефакторинг для «красоты»

---

## Архитектура

### Новые файлы

```
lib/i18n/slices/referral-glossary.js           # 4 языка: 3 axis definitions
components/referral/PartnerMetricsTooltip.jsx   # "?" иконка + popover с пояснением
components/referral/GlossaryDrawer.jsx          # drawer/sheet с полным глоссарием (опционально)
```

### Файлы, которые трогаем (только copy + tooltip)

```
components/referral/ReferralAmbassadorLevels.jsx  # add tooltip к Level 1/2/3 counts
components/referral/LocalLeaderTier.jsx           # add tooltip к "qualified hosts" метрике
components/partner/withdraw-tiers-card.jsx (или аналог)  # add tooltip к "PARTNER role" метрике
components/referral/ReferralTeamMetricsStrip.jsx   # fix copy "хост/бронь" → "заказ/клиент"
components/referral/ReferralProfileTabEarnings.jsx # add glossary link / tooltip
components/referral/ReferralProfilePage.jsx       # mount GlossaryDrawer trigger (опционально)
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role counter)
- `lib/referral/qualified-host-metrics.js` (qualified host — Stage 202.22)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/local-leader-tier.service.js` (community ladder)
- `lib/services/marketing/local-leader-metrics.service.js` (loader)
- `lib/services/finance/*` (waterfall SSOT)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M)
- Live data

---

## Требования

### 1. `lib/i18n/slices/referral-glossary.js`

Глоссарий 3-х осей «партнёр». **Термины** (агрегаторская лексика: «заказ», «клиент», «приглашённый»):

```js
// 3 разных оси, в которых используется слово "партнёр" / "хост":
//
// 1. WITHDRAW % TIERS (Beginner/Pro/Ambassador 60/75/85%)
//    - Считает: role === 'PARTNER' в profiles
//    - Это: "сколько людей зарегистрировалось как партнёр"
//    - Не путать с реальной активностью
//
// 2. NETWORK L1/L2/L3 (split pool 42/10/5/43)
//    - Считает: referrals L1 (любой, кто зарегистрировался по ссылке)
//    - Это: "сколько людей пригласил" (включая пассивных)
//
// 3. COMMUNITY 5 LEVELS (Участник → Лидер региона)
//    - Считает: qualified hosts (L1 invite + ≥1 COMPLETED бронь as partner ИЛИ host_activation)
//    - Это: "сколько активных партнёров" (реальная вовлечённость)

export const REFERRAL_GLOSSARY = Object.freeze({
  withdrawTier: {
    axis: 'withdraw_tier',
    termKey: 'referralGlossary_withdrawTier_term',
    definitionKey: 'referralGlossary_withdrawTier_def',
    exampleKey: 'referralGlossary_withdrawTier_example',
  },
  networkTier: {
    axis: 'network_l1l2l3',
    termKey: 'referralGlossary_networkTier_term',
    definitionKey: 'referralGlossary_networkTier_def',
    exampleKey: 'referralGlossary_networkTier_example',
  },
  communityTier: {
    axis: 'community_5_levels',
    termKey: 'referralGlossary_communityTier_term',
    definitionKey: 'referralGlossary_communityTier_def',
    exampleKey: 'referralGlossary_communityTier_example',
  },
})
```

**i18n ключи (× 4 языка: RU/EN/ZH/TH):**
- `referralGlossary_withdrawTier_term` → «Партнёры (для % вывода)» / «Partners (for withdraw %)» / ...
- `referralGlossary_withdrawTier_def` → «Люди с ролью PARTNER в профиле. Используется для уровня вывода 60/75/85%.»
- `referralGlossary_withdrawTier_example` → «Пример: 10 человек зарегистрировались как партнёры → у вас 10»
- `referralGlossary_networkTier_term` → «Приглашённые L1» / «L1 invites» / ...
- `referralGlossary_networkTier_def` → «Все, кто зарегистрировался по вашей реферальной ссылке. Используется для расчёта L1/L2/L3 начислений в пуле.»
- `referralGlossary_networkTier_example` → «Пример: 5 приглашённых сделали бронирования → у вас есть L2»
- `referralGlossary_communityTier_term` → «Активные партнёры» / «Qualified hosts» / ...
- `referralGlossary_communityTier_def` → «Приглашённые, у которых есть ≥1 COMPLETED бронирование как хост ИЛИ host_activation. Используется для 5-уровневой community-лестницы (Участник → Лидер региона).»
- `referralGlossary_communityTier_example` → «Пример: 3 хоста провели по бронированию → 3 qualified hosts»

### 2. `components/referral/PartnerMetricsTooltip.jsx`

```jsx
// props: { axis: 'withdraw_tier' | 'network_l1l2l3' | 'community_5_levels', t }
// Использует REFERRAL_GLOSSARY[axis]
// "?" иконка через lucide (HelpCircle), не emoji
// Popover/dialog с term + definition + example
// Tailwind, без module.css
```

### 3. Tooltip integration

**`ReferralAmbassadorLevels.jsx`:** рядом с «Level 1», «Level 2», «Level 3» (которые показывают `minPartnersInvited`):
- Добавить `<PartnerMetricsTooltip axis="network_l1l2l3" />`
- Subtitle: «количество приглашённых по реферальной ссылке»

**`LocalLeaderTier.jsx`:** рядом с метрикой `qualifiedHosts`:
- Добавить `<PartnerMetricsTooltip axis="community_5_levels" />`
- Subtitle: «активные партнёры (≥1 COMPLETED бронь)»

**`withdraw-tiers-card.jsx` (или аналог):** рядом с прогрессом до Pro/Ambassador:
- Добавить `<PartnerMetricsTooltip axis="withdraw_tier" />`
- Subtitle: «люди с ролью PARTNER»

### 4. Helper copy fixes (`ReferralTeamMetricsStrip.jsx`)

Audit нашёл: «завершённой бронью», «хостов» в fallback копи. **Замены:**

| Было (dev copy) | Стало (aggregator copy) |
|---|---|
| «завершённой бронью» | «завершённым заказом» |
| «хостов» (когда речь про L1 invites) | «приглашённых» |
| «хостов» (когда речь про community) | «активных партнёров» |
| «completed booking as host» | «завершённый заказ как хозяин» |

**Универсальная лексика (SSOT) — `lib/i18n/get-guest-provider-label.js`:**
- "заказ" / "клиент" / "приглашённый" (агрегатор)
- "хост" — OK только когда речь про partner, не про guest
- "бронь" / "бронирование" — заменяем на "заказ" в публичном UI

### 5. GlossaryDrawer (опционально, small)

Кнопка/ссылка «Как мы считаем?» в `ReferralProfilePage` → drawer с 3-осевым глоссарием (re-use `PartnerMetricsTooltip` content). Если scope лезет, **не делать** — достаточно tooltip'ов.

### 6. Тесты (`__tests__/stage-202-26-partner-glossary.test.js`)

Минимум 4:

1. `REFERRAL_GLOSSARY` имеет 3 axis'а, каждый с termKey/definitionKey/exampleKey
2. `PartnerMetricsTooltip` рендерится с правильным axis (smoke test)
3. Helper copy не содержит запрещённых терминов: «гость-путешественник», «бронь», «бронь» (в публичном UI). Источник SSOT: `lib/i18n/get-guest-provider-label.js`
4. Все 3 компонента (`ReferralAmbassadorLevels`, `LocalLeaderTier`, `withdraw-tiers-card`) содержат `PartnerMetricsTooltip` с правильным axis

Опционально:
5. 4 языка имеют все glossary ключи (no fallback to RU)

---

## SSOT — не трогать

- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role counter — definition)
- `lib/referral/qualified-host-metrics.js` (qualified host — definition)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/local-leader-tier.service.js` (community ladder compute)
- `lib/services/marketing/local-leader-metrics.service.js` (loader)
- `lib/services/marketing/quest-progress.service.js`
- `lib/services/marketing/leader-roadmap.service.js`
- `lib/config/leader-tier-thresholds.js`
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/services/finance/*` (waterfall SSOT)
- Live `system_fintech_settings`
- ADR-131, ADR-131A

---

## Smoke на prod (после деплоя)

1. **`/profile/referral`:** все 3 места с числами «партнёров» имеют tooltip "?" с правильным axis
2. **Withdraw tier card:** tooltip объясняет `role === PARTNER`
3. **Ambassador Levels (L1/L2/L3):** tooltip объясняет L1 invites (любые приглашённые)
4. **Local Leader Tier:** tooltip объясняет qualified hosts
5. **Helper copy:** «завершённой бронью» больше нет в TeamMetricsStrip (если есть → исправить)
6. **i18n:** переключение RU/EN/ZH/TH — все tooltip'ы переводятся
7. **Не сломалось:** Stage 202.22/202.23/202.24, calculator, leaderboard
8. **Audit log:** ничего нового не пишется (этот Stage — copy-only)

---

## Definition of Done

- [ ] `lib/i18n/slices/referral-glossary.js` создан, 3 axis'а × 3 ключа × 4 языка
- [ ] `components/referral/PartnerMetricsTooltip.jsx` создан, lucide HelpCircle, без module.css
- [ ] 3 компонента (`ReferralAmbassadorLevels`, `LocalLeaderTier`, `withdraw-tiers-card`) имеют `<PartnerMetricsTooltip>` с правильным axis
- [ ] Helper copy в `ReferralTeamMetricsStrip.jsx` заменён на агрегаторскую лексику
- [ ] (Опционально) `GlossaryDrawer` смонтирован в `ReferralProfilePage`
- [ ] 4+ unit-теста pass
- [ ] НЕ тронуты SSOT-сервисы (определения, пороги, формулы)
- [ ] НЕ сломан Stage 202.22/202.23/202.24/202.21
- [ ] Git commit: `Stage 202.26 — Partner metrics glossary + UI disambiguation (copy-only)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.26
2. **Smoke** на dev + prod (8 пунктов)
3. **Решить про Stage 202.25** (snapshot fail-closed / backfill / inventory+freeze) — у тебя теперь есть время
4. **Связаться с медиаперсонами** (узкое место №1)

**Дальше (Stage 202.27+ из audit):**
- 202.27: engagement perf (P1/P2)
- 202.28: docs passport sync (P2, Cursor через `.cursorrules`)
- 202.29: community i18n currency polish (P1/P2)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **copy-only**, не изобретение. Если Cursor уточняет — отвечай на основе SSOT (`referral-tier-sync.service.js` для PARTNER role, `qualified-host-metrics.js` для qualified host, `get-guest-provider-label.js` для терминологии), **не меняй** определения.
