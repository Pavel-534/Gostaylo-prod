# Stage X — UX Quick Wins + Compliance Copy — Промт для Cursor

**Зачем:** Pavel показал скриншоты рефералки. Audit (visual review, не код) нашёл 5 UX-проблем + 5 compliance-инсайтов из Airbnb Terms. Бэкенд готов (10 этапов, 0 P0), фронт **отстаёт**.

**Скоуп:** ТОЛЬКО copy + UI tweaks. БЕЗ денег, БЕЗ RBAC, БЕЗ миграций, БЕЗ изменения SSOT. **Read-mostly**: компоненты уже есть, добавляем copy/визуал.

---

## Что строим

### Базовые UX-фиксы (из скриншотов Pavel'я)

1. **Landing "₽0"** → переписать, чтобы не выглядело как "0 рублей заработаешь"
2. **Quest disclaimer** → "до +X ₽ из промо-бюджета" под каждой суммой
3. **L3 в roadmap "L3 в сети (live)"** → убрать "(live)" (это L3 shadow, не live; вводит в заблуждение)
4. **Verified-by в roadmap "Проверено платформой — ускоренный вывод"** → убрать или "Q4 2026 после legal" (audit упомянул, что мы НЕ делаем)
5. **Squad Quests lock** → tooltip "Стань Лидером региона → разблокируется" (как разблокировать)
6. **Host-side reward card** → новая карточка "Приведи хозяина → 500 THB" в hero (главная дыра — supply-side MLM не отображается)

### Compliance-фиксы (из Airbnb Terms)

7. **Disclosure copy** в host-referral → "Я могу получить вознаграждение, когда вы разместите объявление по моей ссылке" (обязательно для compliance)
8. **Per-user cap** в copy → "максимум 50 рефералов в год" (anti-monopoly; у Airbnb 10/год, у нас 50 — больше)
9. **Tax disclaimer** в copy → "Вы несёте ответственность за налоги с вознаграждения" (compliance)
10. **"Не агент Airento" disclaimer** → "Вы рекомендуете, а не представляете Airento" (для leader-стратегии)

---

## Не делать (явно)

- ❌ Не менять money formulas, RBAC, ledger
- ❌ Не менять SSOT-файлы (waterfall, payout, cap, snapshot, qualified-host, region, audit)
- ❌ Не делать новых tier-систем
- ❌ Не добавлять L3 live, public leader page, stories, push (Q4+)
- ❌ Не реализовывать quest claim money (Stage 202.36)
- ❌ Не лезть в Stage 202.21-202.30 (не трогать)
- ❌ Не делать новые API endpoints (только copy)
- ❌ Не делать backend logic (только UI/copy)

---

## Архитектура

### Новые файлы

```
lib/translations/slices/landing-referral.js          # 4 языка: landing copy
lib/translations/slices/referral-disclaimers.js     # 4 языка: disclosure/tax/cap/no-agent
components/referral/HostReferralCard.jsx            # NEW: "Приведи хозяина → 500 THB"
components/referral/RoadmapLockTooltip.jsx          # NEW: lock tooltip для "скоро" пунктов
__tests__/stage-x-ux-quick-wins.test.js             # 6+ тестов
```

### Файлы, которые трогаем (только copy + UI tweak)

```
app/(public)/referral/page.jsx                      # landing: "₽0" → переписать
app/referral-public/page.jsx                        # публичный лендинг (если есть)
components/referral/LocalLeaderTier.jsx             # roadmap lock tooltips
components/referral/QuestsBlock.jsx                 # disclaimer
components/referral/ReferralLeaderEngagementSection.jsx  # host-side card mount
components/referral/ReferralProfilePage.jsx         # host-side card, disclaimers
components/referral/ReferralProfileTabEarnings.jsx  # per-user cap, tax disclaimer
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
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- `lib/referral/qualified-host-metrics.js`
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. Landing "₽0" → переписать

**Было:**
```
02 Получайте ₽0
До ₽0 можно кредитовать на первую бронь: жильё, транспорт, услуги на платформе.
```

**Стало (пример для RU):**
```
02 Используйте бонус на первую бронь
Зарегистрируйтесь — и бонус за приглашение автоматически появится при оплате вашего первого бронирования (жильё, транспорт, услуги).
```

**Или (честный tone):**
```
02 Получите бонус на первое бронирование
Размер бонуса зависит от страны и отправителя — указан в вашем приглашении.
```

**Без хардкода "₽0" или "0 рублей".** i18n через `lib/translations/slices/landing-referral.js`.

### 2. Quest disclaimer "до +X ₽ из промо-бюджета"

**В `QuestsBlock.jsx`** под списком квестов добавить:
```
"Награды начисляются из промо-бюджета, не из пула реферальной программы. Выплата — отдельным этапом после выполнения условия."
```

**Или в каждом quest** (мелким шрифтом под наградой):
```
"+100 ₽" (мелким: "из промо-бюджета, условие выполнено → отдельная выплата")
```

**4 языка**, через `leaderQuests_disclaimer` ключ (уже есть с Stage 202.29b, проверить полноту).

### 3. L3 в roadmap "L3 в сети (live)" → убрать "(live)"

**В `LocalLeaderTier.jsx`** или где рендерится roadmap:
- Было: `L3 в сети (live)`
- Стало: `L3 в сети` (без "(live)")
- Или с tooltip: `L3 в сети` + hint "Скоро после legal sign-off"

**Проверить `leaderRoadmap_item*` ключи** в `lib/translations/slices/leader-roadmap.js` — убрать "live" везде.

### 4. Verified-by в roadmap → убрать

**Было:** "Проверено платформой — ускоренный вывод"
**Стало:** убрать ИЗ roadmap. Или честно: "Q4 2026 после юридического согласования".

**Audit упомянул:** "Verified-by ускоренный payout — НЕ делаем (требует ADR, убыточно на 3k чеках)". Не обещаем то, что не делаем.

**В `lib/translations/slices/leader-roadmap.js`:** заменить копирайт или удалить item.

### 5. Squad Quests lock → tooltip

**В `LocalLeaderTier.jsx`** или `TierRoadmap.jsx`:
- Lock-иконка + tooltip
- Tooltip: "Становитесь Лидером региона — открываются командные квесты"
- Ссылка на docs или admin

**Через `<ReferralLeaderEngagementSection>` или roadmap component.**

### 6. Host-side reward card (главная дыра)

**NEW `components/referral/HostReferralCard.jsx`:**

```jsx
// 4 языка, copy + example
// "Приведи хозяина" — наш MLM supply-side мотиватор
// Host activation 500 THB (из Promo Tank, не из pool)
// 42% L1 от его пула
```

**Структура:**
- Заголовок: "Приведи хозяина" (иконка home/host)
- Subtitle: "Ваш реферал получит 500 THB на старт. Вы получите 42% от его пула."
- Calculator preview: "Если ваш хост заработает 1 000 THB/мес → вам 420 THB/мес"
- CTA: "Поделиться ссылкой" (copy ref link)

**Mount:** в `ReferralLeaderEngagementSection.jsx` или `ReferralProfileTabEarnings.jsx` — между текущими секциями.

**Disclosure обязательна** (item 7) — мелким шрифтом под карточкой.

### 7. Disclosure copy в host-referral

**В `HostReferralCard.jsx` (мелким шрифтом):**
```
RU: "Я могу получить вознаграждение, когда вы разместите объявление по моей реферальной ссылке"
EN: "I may receive a reward when you list your place using my referral link"
ZH: "我可能因您通过我的推荐链接上线而获得奖励"
TH: "ฉันอาจได้รับรางวัลเมื่อคุณลงทะเบียนที่พักผ่านลิงก์แนะนำของฉัน"
```

**В `lib/translations/slices/referral-disclaimers.js`:**
```js
hostReferralDisclosure: {
  ru: '...',
  en: '...',
  zh: '...',
  th: '...',
}
```

**Требование Airbnb — обязательно для host-referral, чтобы не нарушать consumer protection laws.**

### 8. Per-user cap "максимум 50 рефералов в год"

**В `ReferralProfileTabEarnings.jsx`** (или disclaimer footer):
- "Максимум 50 успешных рефералов в год" (или динамически из backend)
- Сейчас cap 1M THB/мес на программу, **нет per-user cap** — gap

**В `lib/translations/slices/referral-disclaimers.js`:**
```js
perUserCap: {
  ru: 'Не более 50 успешных рефералов в год на одного пользователя',
  en: 'Up to 50 successful referrals per user per year',
  zh: '每位用户每年最多 50 个有效推荐',
  th: 'ไม่เกิน 50 การแนะนำที่สำเร็จต่อผู้ใช้ต่อปี',
}
```

**Важно:** это COPY-ONLY в этом Stage. Реальное enforcement (DB constraint) — отдельный этап. У Airbnb 10/год, у нас 50/год — больше для viral growth.

### 9. Tax disclaimer

**В `ReferralProfileTabEarnings.jsx`** (footer):
- "Вы несёте ответственность за налоги с вознаграждения в соответствии с законодательством вашей страны"
- Ссылка на `/legal/terms` (или `/legal/offer`)

**В `lib/translations/slices/referral-disclaimers.js`:**
```js
taxResponsibility: {
  ru: 'Вы самостоятельно несёте ответственность за налоги с вознаграждения',
  en: 'You are solely responsible for any taxes on rewards',
  zh: '您需自行承担奖励相关的税务责任',
  th: 'คุณเป็นผู้รับผิดชอบภาษีจากรางวัลด้วยตนเอง',
}
```

### 10. "Не агент Airento" disclaimer

**В `HostReferralCard.jsx`** (мелким шрифтом) или `ReferralProfileTabEarnings.jsx`:
- "Вы рекомендуете Airento, а не представляете нас. У вас нет агентских отношений с Airento."

**В `lib/translations/slices/referral-disclaimers.js`:**
```js
noAgencyRelationship: {
  ru: 'Вы рекомендуете Airento как обычный пользователь, а не как агент или представитель. У вас нет агентских отношений с Airento.',
  en: 'You refer Airento as a regular user, not as an agent or representative. You have no agency relationship with Airento.',
  zh: '您以普通用户身份推荐 Airento，而非作为代理或代表。您与 Airento 不存在代理关系。',
  th: 'คุณแนะนำ Airento ในฐานะผู้ใช้ทั่วไป ไม่ใช่ตัวแทนหรือผู้แทน คุณไม่มีความสัมพันธ์ในฐานะตัวแทนกับ Airento',
}
```

**Compliance Airbnb:** нельзя создавать материалы с брендом или подразумевающие агентские отношения.

### 11. Тесты `__tests__/stage-x-ux-quick-wins.test.js`

Минимум 6:

1. Landing НЕ содержит "₽0" или "0 рублей" в copy
2. Quests disclaimer присутствует в `QuestsBlock.jsx` для всех 4 языков
3. L3 в roadmap НЕ содержит "(live)"
4. Verified-by или удалён из roadmap, или имеет честный "Q4 2026 после legal"
5. Squad Quests lock имеет tooltip
6. `HostReferralCard.jsx` создан, содержит:
   - disclosure copy (item 7)
   - 500 THB host activation
   - 42% L1 от пула
   - no-agency disclaimer
7. Per-user cap "50 рефералов в год" присутствует в copy
8. Tax disclaimer присутствует в copy
9. No-agency disclaimer присутствует в copy
10. Все 4 языка в `referral-disclaimers.js` (no fallback to RU)
11. Existing tests (Stage 202.22, 202.26, 202.29b) still pass (no regression)

---

## SSOT — не трогать

(см. список выше)

---

## Smoke на prod (после deploy)

1. **Landing page:** первое впечатление — не "0 рублей", а "бонус на первое бронирование"
2. **`/profile/referral` Quests block:** disclaimer "до +X ₽ из промо-бюджета" виден
3. **Roadmap (LocalLeaderTier / TierRoadmap):** "L3 в сети" БЕЗ "(live)"
4. **Verified-by:** или убран, или с честной датой
5. **Squad Quests:** lock с tooltip
6. **HostReferralCard:** видна с 500 THB, 42%, disclosure, no-agency
7. **Disclaimers:** все видны в `ReferralProfileTabEarnings.jsx` footer
8. **RU-first:** все copy переводы читаемы
9. **i18n completeness:** все 4 языка
10. **Не сломалось:** Stage 202.21-202.30, Phase A/B FinTech, calculator, leaderboard

---

## Definition of Done

- [ ] `lib/translations/slices/landing-referral.js` создан, 4 языка, без "₽0" copy
- [ ] `lib/translations/slices/referral-disclaimers.js` создан, 4 языка × 4 ключа (disclosure/tax/cap/no-agency)
- [ ] `components/referral/HostReferralCard.jsx` создан, 4 языка, с disclosure + no-agency
- [ ] `components/referral/RoadmapLockTooltip.jsx` создан (опционально)
- [ ] Landing переписан (без "₽0")
- [ ] Quests disclaimer виден
- [ ] L3 в roadmap без "(live)"
- [ ] Verified-by в roadmap или убран, или с честной датой
- [ ] Squad Quests lock с tooltip
- [ ] HostReferralCard смонтирован в `ReferralLeaderEngagementSection` или `ReferralProfileTabEarnings`
- [ ] Per-user cap, tax disclaimer, no-agency disclaimer в `ReferralProfileTabEarnings`
- [ ] 6+ unit-тестов pass
- [ ] НЕ тронуты SSOT, RBAC, ledger, Stage 202.21-202.30
- [ ] НЕ сделаны новые API endpoints
- [ ] Git commit: `Stage X — UX quick wins + Airbnb compliance copy`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage X
2. **Smoke** на dev (10 пунктов) + на prod
3. **Потом** Stage Y (host-side economy UI, 2-3 дня)
4. **Потом** Stage Z (tier disambiguation, 3-5 дней)
5. **Параллельно оффлайн:** trademark, домены, медиа-контакты

**Дальше (после паузы):**
- ADR-300 audit
- Stage 202.31 (integration smoke e2e) — после Stage Y/Z
- Stage 202.32 (SYSTEM_MAP sync) — мелкий, можно параллельно
- Stage 202.34 (fraud/emergency audit) — после Stage 202.31

---

**Конец промта.** Скопируй и отправь в Cursor. Это **только copy + UI tweaks**, read-mostly. Если Cursor уточняет — отвечай на основе `lib/translations/` структуры (slices × 4 языка), `ReferralLedgerAmount` (для отображения сумм), `lucide` (иконки). **Не изобретай** новые компоненты, **не трогай** SSOT.
