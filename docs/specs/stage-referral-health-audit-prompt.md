# Referral System Health Audit — Промт для Cursor

**Зачем:** 31.08-01.09 закрыли 3 крупных этапа подряд (202.21 Phase B FinTech, 202.22 Leader Engagement, 202.23 Region Admin). Каждый раз мой ТЗ содержал 5-7 ошибок про pre-existing инфраструктуру, которые Cursor правил. Это значит: есть **ещё «тихие» косяки**, которые проявятся на проде.

**Этот этап — ТОЛЬКО ДИАГНОСТИКА.** Без кода, без рефакторинга, без фиксов. Cursor пишет 1 аудит-док, оттуда берём Stage 202.24+.

---

## Контекст: что у нас за рефералка (что audit должен знать)

Наша рефералка **не Airbnb-копия** и не классический MLM. Уникальность (источник: Яндекс-скриншоты рынка аренды, идеи Grok и Gemini по модели роста):

1. **3-level network depth (L1/L2/L3)** — редкость в аренде, конкурентное преимущество перед Airbnb
2. **5-уровневая community-лестница** (Участник/Активист/Наставник/Лидер/Лидер региона) — отдельная ось от финансовой
3. **% вывода** (Beginner/Pro/Ambassador 60/75/85) — третья ось
4. **Pool 45%** на старте (НЕ 80% — это разорит платформу). Рост до 50% при 100+ бронированиях/мес, до 55-60% при 300+
5. **Split 42/10/5/43** — фиксирован, не меняется
6. **Cap 1M THB/мес** — safety lock
7. **Regional ownership** — 1-2 лидера на город, офлайн-доминирование через Starter Kit
8. **Verified-by badge** — на листинге, доверие к хозяину
9. **Promo Tank + Turbo boost** — controlled budget, НЕ глобальный % pool
10. **fintech_snapshot** в `bookings.metadata` — исторические начисления не пересчитываются
11. **Soft launch**: Тай + РФ, нет реальных партнёров/гостей, **никакого фейка** в маркетинге

**Audit должен проверять, что эта уникальность НЕ размывается** в коде, копирайте и SSOT.

---

## Что строим (deliverable)

**Один аудит-док:** `docs/audits/stage-referral-health-2026-09-XX.md`

Структура:
- TL;DR (status по 7 осям: ✅/⚠️/❌)
- Подробные findings по каждой оси с severity (P0/P1/P2)
- Список рекомендованных Stage 202.24+ (с приоритетами)
- Что НЕ найдено (negative findings — чтобы знали, что проверено)

**Без кода. Без миграций. Без фиксов.** Cursor только ЧИТАЕТ код и пишет markdown.

---

## Что НЕ делать

- ❌ Не править код
- ❌ Не предлагать фиксы прямо сейчас (только рекомендации в Stage 202.24+)
- ❌ Не изобретать новые фичи
- ❌ Не трогать SSOT-файлы
- ❌ Не менять live data
- ❌ Не ломать Stage 202.21/202.22/202.23 при grep (только read)

---

## 7 осей аудита

### 1. SSOT discipline (финансы и referral-логика)

**Проверить:**

a) **Pool 45%** — кто читает `referral_reinvestment_percent`?
   - Источник: `system_fintech_settings.referral_reinvestment_percent` (live) или `lib/config/fintech-config-defaults.js` (bootstrap)
   - **Не должно быть** хардкода `0.45` или `45` в сервисах waterfall/payout
   - Phase A закрыл дрифт, но ищем места, где забыли перейти на live

b) **Split 42/10/5/43** — кто делит pool?
   - Источник: `ambassador_guest_pool_l1_percent`, `_l2_percent`, `_l3_percent`, `_referee_percent` в FinTech panel
   - **Не должно быть** хардкода `0.42`/`0.10`/`0.05`/`0.43` в коде
   - **Не должно быть** другого split вне `referral-payout.service.js`

c) **Cap 1M** — `referral_monthly_program_cap_thb`
   - Источник: `system_fintech_settings.referral_monthly_program_cap_thb`
   - **Не должно быть** проверок `if (sum > 1000000)` в коде
   - **Только** `referral-program-cap.service.js`

d) **Acquiring 4.3%, USN 6%, VAT 5%, insurance 0.5%, reserve 0.5%** — waterfall
   - Источник: `fintech-config-defaults.js` (после Stage 202.21: cap 1M, split 42/10/5/43)
   - **Не должно быть** хардкода процентов в `fintech-waterfall.js` (он читает SSOT) — но ищем **копипаст waterfall** в других сервисах

e) **3 tier-системы** — не перепутаны в копирайте и расчётах:
   - Withdraw % (Beginner/Pro/Ambassador) — `referral-tier-sync.service.js`
   - Network L1/L2/L3 (split pool) — `referral-payout.service.js`
   - Community 5 levels (engagement) — Stage 202.22 (read-only)
   - Проверить, что в UI компонентах, копирайт-файлах, i18n — **нет смешения**

f) **fintech_snapshot** — каждая бронь имеет snapshot на момент оплаты
   - **Не должно быть** обращений к live `system_fintech_settings` при расчёте начислений по существующим броням
   - **Только** в новых бронях при checkout

g) **Qualified host** — `lib/referral/qualified-host-metrics.js`
   - **Не должно быть** другого определения (особенно в `referral-fraud-gate.service.js` — он антифрод)

h) **Region** — `profiles.metadata.local_leader_region_id`
   - **Только** через `local-leader-region.service.js` (admin)
   - **Не должно быть** direct write в `profiles.metadata` из других мест

**Severity matrix:**
- P0: live ≠ SSOT (drift), хардкод финансовых значений, копипаст waterfall
- P1: 3 tier-системы перепутаны в copy, fintech_snapshot не используется
- P2: неоптимальный путь чтения, нет кэширования

---

### 2. Write-path audit (безопасность мутаций)

**Проверить каждый эндпоинт, который мутирует state:**

a) **Auth + RBAC matrix** — для `/api/v2/admin/**`:
   - Зарегистрирован ли prefix в `lib/admin/admin-api-access.ts`?
   - Если нет — fail-closed (только ADMIN)
   - Phase B нашёл dual-write, Stage 202.23 нашёл missing registration — **ищем ещё такие места**

b) **Audit log** — каждая мутация пишет в `admin_audit_logs` через `recordAdminAudit()`?
   - Проверить payload-формат: `{ action, entity_type, entity_id, payload_json: { before, after, source } }`
   - Особое внимание: payout actions, force_refund, freeze_payment, settings changes, profile mutations

c) **Idempotency-Key** — для write-endpoints (mutation может повториться):
   - Поддерживается ли в route?
   - Helpers в `admin-audit.js`?

d) **Self-protection**:
   - Может ли admin изменить сам себя (super-admin exception)?
   - Может ли user отключить свой KYC/email-verified?
   - Self-assign в region admin (Stage 202.23 это закрыл, ищем аналоги)

e) **Payout actions** — самые опасные:
   - `admin/payouts/[id]/route.js` — статус PAID/FAILED
   - `admin/partner-payout-profiles/[id]/route.js` — KYC verify
   - `admin/bookings/[id]/emergency-actions/route.js` — emergency
   - `admin/disputes/[id]/action/route.js` — dispute resolution
   - Проверить: idempotency, audit, RBAC, валидация сумм

f) **CSRF / re-auth**:
   - Для критичных мутаций (settings, payouts) — нужен свежий session?
   - Re-auth для admin write (Stage 202.21: server guardrail + ack для acquiring=0)

g) **Race conditions** в write-path:
   - Concurrent updates одного профиля — last-write-wins или merge?
   - Concurrent payouts — double-pay?

**Severity matrix:**
- P0: admin endpoint без audit, без RBAC matrix registration
- P1: нет idempotency, нет self-protection
- P2: нет re-auth, нет rate limit

---

### 3. i18n completeness

**Проверить:**

a) **4 языка**: RU / EN / ZH / TH — везде?
   - Особое внимание: новые компоненты 202.22 (LocalLeaderTier, QuestsBlock, TierRoadmap) и 202.23 (LocalLeaderRegionCard)
   - **Не должно быть** hardcoded русских строк в `.jsx` файлах
   - **Не должно быть** hardcoded английских строк в RU-локали (был баг в `partner-shell.js`)

b) **Слайс-структура** — `lib/translations/slices/`:
   - Новые слайсы подключены в `lib/translations/index.js` или аналоге?
   - `register-*.js` файлы нужны? (Stage 202.23 использовал `register-admin-local-leader.js`)

c) **Деньги в copy**:
   - Должна быть **валюта шапки** (THB/₽/$)
   - Используется `ReferralLedgerAmount` / `formatThbAsDisplay` (не hardcoded "THB")
   - **Не должно быть** "+100 THB" строкой в коде — компонент

d) **Disclaimers**:
   - Quests: "из промо-бюджета, не из пула" — есть?
   - Marketing claims: "тысячи объектов" — нет? (закрыто в Stage 201.10)
   - Legal: ссылки на `/legal/privacy` и т.д. на правильном языке

e) **Universal terminology** (aggregator):
   - "заказ" / "клиент" / "приглашённый" — не "бронь" / "гость" / "реферал"
   - Источник: `lib/i18n/get-guest-provider-label.js` (SSOT)
   - Проверить, что ВСЕ user-facing тексты используют правильную лексику

f) **Tier names** (3 системы):
   - Withdraw: Новичок/Beginner/参与者/ผู้เริ่มต้น
   - Network: L1/L2/L3 (без перевода, это id)
   - Community: Участник/Активист/Наставник/Лидер/Лидер региона (× 4 языка)
   - **Не должно быть** смешения в одном блоке

g) **Источник SSOT для tier'ов** — `lib/i18n/get-guest-provider-label.js` уже SSOT для "гость/рентер". Проверить, что везде используется.

**Severity matrix:**
- P0: hardcoded русский/английский в коде, нет i18n для критичных экранов
- P1: "+100 THB" в коде, "бронь/гость" в публичном UI
- P2: непоследовательный тон, разные переводы одного термина

---

### 4. Design system consistency

**Проверить:**

a) **PartnerSectionDivider** — mint-hairline divider:
   - Применён везде в partner cabinet или частично?
   - Не использованы ли `border-t border-slate-200` напрямую (когда должен быть divider)?

b) **Header hierarchy** (h1/h2/h3):
   - Один стиль на весь проект
   - Нет ли мест, где `<div className="text-2xl font-bold">` вместо `<h2>`

c) **Helper-under-input** (helper text под полями):
   - Во всех формах?
   - Используется ли helper, или просто плейсхолдер?

d) **Input-border-contrast**:
   - В формах admin — правильные borders?
   - `border-slate-200` vs `border-slate-300` vs другие

e) **Card separation**:
   - Где должны быть cards с тенью, а где без
   - Применяется ли `Card` компонент или `<div className="rounded border">`

f) **Tailwind tokens only**:
   - **Не должно быть** `.module.css` файлов (Stage 202.22 убрал LocalLeaderTier.module.css)
   - Токены через `lib/theme/tokens`
   - Проверить существование `.module.css` в `components/referral/`, `components/admin/`, `app/`

g) **Badge variants**:
   - Только default/secondary/destructive/outline (НЕ warning)
   - Проверить, что нигде нет `variant="warning"`

h) **Lock иконка**:
   - Через lucide `Lock`, не emoji
   - Проверить roadmap/tier с lock

i) **lucide-react vs emoji**:
   - Проверить, что иконки — lucide, не 🔒/🛠️ emoji в production UI

**Severity matrix:**
- P0: `.module.css` в новых компонентах, нестандартный Badge variant
- P1: header hierarchy сломан, разные card patterns на одной странице
- P2: helper-text отсутствует в формах

---

### 5. Performance

**Проверить:**

a) **N+1 queries**:
   - `/engagement` endpoint (Stage 202.22) — single loader или N запросов?
   - Leaderboard — один запрос или per-user?
   - Finance summary — aggregation или N fetch?

b) **Hot endpoints без кэша**:
   - `GET /api/v2/referral/me/engagement` — read-heavy, кэш?
   - `GET /api/v2/referral/leaderboard/public` — public, кэш?
   - `GET /api/v2/partner/finances-summary` — partner reads, кэш?

c) **Калькулятор (public)** — `GET /api/v2/referral/calculator`:
   - Static inputs (split/cap/pool), нет DB
   - Можно ли кэшировать дольше?
   - Сейчас cache headers какие?

d) **DB indexes**:
   - `referral_relations` — index по `referrer_id`?
   - `referral_ledger` — index по `(referrer_id, earned_at DESC)`, `(status, earned_at)`?
   - `bookings` — index по `(partner_id, status)` для qualified-host-metrics?
   - `profiles` — index по metadata JSON path `local_leader_region_id`?

e) **Aggregation queries**:
   - `sumReferralEarnedThb` — full table scan или indexed?
   - `countQualifiedHosts` — есть ли кэш на 5 минут?

f) **Client-side бандл**:
   - `/profile/referral` тянет много? (LocalLeaderTier + QuestsBlock + TierRoadmap + calculator + balance + activity)
   - Lazy loading для тяжёлых компонентов?
   - `next/dynamic` для Stage 202.22/202.23?

g) **Edge runtime**:
   - Какие routes на edge, какие на node?
   - `/engagement` — DB-тяжёлый, должен быть node, не edge

**Severity matrix:**
- P0: N+1 на hot endpoint (>100 req/min)
- P1: нет кэша на read-heavy, нет DB index для частого запроса
- P2: large bundle, нет lazy loading

---

### 6. Dead code / orphan endpoints

**Проверить:**

a) **Orphan API endpoints**:
   - `grep` routes в `app/api/v2/` — все ли в навигации?
   - Не покрытые тестами — кандидаты на dead code
   - Не упомянутые в `docs/SYSTEM_MAP.md`

b) **Orphan components**:
   - `grep` `components/` — есть ли `.jsx` без импорта?
   - `__tests__/` — есть ли тесты для компонентов, которые не используются?

c) **Orphan i18n keys**:
   - `lib/translations/slices/` — все ли ключи где-то используются?
   - Reverse grep: `grep -r "stageXYZ_"` — найти мёртвые ключи

d) **Orphan DB columns**:
   - `bookings`, `profiles`, `referral_ledger` — есть ли колонки, которые никто не читает?
   - Спросить Pavel перед удалением (может, готовятся к Stage 202.24+)

e) **Заброшенные features**:
   - Этапы, которые были started, но не finished
   - TODO/FIXME без даты
   - `.skip` / `.todo` в тестах

f) **Legacy файлы**:
   - `lib/admin/admin-api-access.js` (js, не ts) — есть ли `admin-api-access.ts`? Какой используется?
   - `lib/services/finance/referral-fintech-admin-sync.js` — всё ещё используется?
   - Старые payment integrations (Stripe, PayPal) — dead или активны?

g) **Documentation drift**:
   - `docs/SYSTEM_MAP.md` упоминает endpoint, которого нет
   - `docs/HISTORY.md` упоминает Stage, который не коммитился
   - `docs/TECHNICAL_MANIFESTO.md` — не отражает реальный код

**Severity matrix:**
- P0: orphan endpoint с уязвимостью (забытый, не патченный)
- P1: большие мёртвые куски кода, тесты для неиспользуемого
- P2: мелкий dead code, i18n ключи без использования

---

### 7. Race conditions / consistency

**Проверить:**

a) **`referral_ledger` concurrent writes**:
   - Один COMPLETED booking → несколько reward entries (L1/L2/L3)
   - Что если 2 параллельных complete (race)?
   - Unique constraint? Idempotency?

b) **`referral_relations` cycles**:
   - User A invites B, B invites A — что происходит?
   - Self-referral запрещён?
   - Глубина сети — есть ли cap?

c) **Leaderboard staleness**:
   - `GET /api/v2/referral/leaderboard/public` — реальное время или кэш?
   - При 100K users, обновление — триггер на INSERT или periodic?
   - Можно ли стать #1 фейково, если cache invalidation баг?

d) **Tier recompute timing**:
   - `computeLocalLeaderTier` (Stage 202.22) — read-only, OK
   - Но если user только что получил qualified host — когда tier пересчитается?
   - Live tier vs cached tier — inconsistency?

e) **Payout + cap race**:
   - Если несколько COMPLETED в одно и то же время, и cap почти исчерпан
   - Кто получает, кто defer'ится?
   - Order of operations?

f) **Booking status transitions**:
   - PAID_ESCROW → CONFIRMED → COMPLETED
   - Что если PARTNER одновременно завершает, а GUEST открывает dispute?
   - FSM корректна? (см. ADR/Constitution)

g) **Currency conversion**:
   - 1k THB booking, RUB оплата — `bookings.exchange_rate` фиксируется при оплате
   - Что если RUB-курс падает между оплатой и COMPLETED?
   - RUB-fallback bug (carryover) — есть ли ещё места?

h) **MLM consent**:
   - `referral_mlm_consent_at` — кто пишет?
   - Что если user дал consent, потом ушёл и вернулся?
   - Двойной opt-in?

i) **Region assignment** (Stage 202.23):
   - Два admin'а одновременно назначают разные регионы
   - `updated_at` last-write-wins или merge?
   - Audit log captures правильно?

**Severity matrix:**
- P0: race в payout (double-pay), в ledger (двойное начисление)
- P1: leaderboard staleness > 1 часа, tier inconsistency
- P2: мелкие timing issues, edge cases

---

## Формат deliverable

`docs/audits/stage-referral-health-2026-09-XX.md`:

```markdown
# Referral System Health Audit — 2026-09-XX

## TL;DR
- SSOT discipline: ✅ / ⚠️ / ❌
- Write-path: ✅ / ⚠️ / ❌
- i18n: ✅ / ⚠️ / ❌
- Design system: ✅ / ⚠️ / ❌
- Performance: ✅ / ⚠️ / ❌
- Dead code: ✅ / ⚠️ / ❌
- Race conditions: ✅ / ⚠️ / ❌

P0 findings: N
P1 findings: N
P2 findings: N

## Axis 1: SSOT discipline
### ✅ What's correct
- ...
### ⚠️ Findings
- [P1] ...
### ❌ Critical
- [P0] ...

## Axis 2: Write-path
... (same)

## Recommended Stage 202.24+ (prioritized)
1. Stage 202.24: <title> (P0, ~1 day)
   - Files: ...
   - Risk: ...
2. Stage 202.25: <title> (P1, ~2-3 days)
   - ...
3. ...

## Negative findings (что проверено и OK)
- <что проверено, не нашлось проблем>
```

---

## Definition of Done для audit'а

- [ ] Cursor прочитал 7 осей, проверил каждую
- [ ] Написал `docs/audits/stage-referral-health-2026-09-XX.md` (по формату выше)
- [ ] Каждое finding имеет severity (P0/P1/P2) + file:line + рекомендация
- [ ] Список Stage 202.24+ с приоритетами
- [ ] Negative findings (что OK) — чтобы знали, что проверено
- [ ] БЕЗ кода, БЕЗ фиксов, БЕЗ изменений в репо

---

## После audit'а (Pavel + я)

1. Я (Mavis) прочитаю audit-док
2. Расставлю приоритеты по стратегии (что первым)
3. Дадим Cursor'у **промт на Stage 202.24+** — фикс топ-P0/P1 из audit'а
4. И так далее, пока audit не даст 0 P0 и приемлемо P1

**Audit — это начало фазы "fix the foundation", не конец.** Цель: 0 P0, ≤3 P1 на проде, прежде чем добавлять новые фичи.

---

## Чего audit НЕ должен делать (anti-scope)

- ❌ Не предлагать рефакторинг «для красоты»
- ❌ Не предлагать новые фичи
- ❌ Не менять SSOT файлы
- ❌ Не удалять «подозрительный» код без доказательств, что он dead
- ❌ Не критиковать архитектуру в целом (есть ADR'ы — там обсуждается)
- ❌ Не лезть в `lib/services/finance/*` (waterfall SSOT — sensitive)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **диагностика, не фикс** — Cursor пишет 1 markdown-док, всё. Audit — это старт фазы "fix the foundation" перед следующей фичей.
