# Реферальная программа — руководство для владельца продукта

**Версия:** 2026-08-19 · **SSOT кода:** `lib/services/marketing/referral-*.js`, `docs/ADR/131A-ambassador-3-1-multi-level.md`, `docs/BUSINESS_LOGIC_REFERRAL.md`, `docs/REFERRAL_FINANCIAL_FLOW.md`

Документ для **вас как владельца Airento**: что система делает, как ею управлять, где смотреть цифры и на что обратить внимание. Технические детали сведены к минимуму.

---

## 1. Зачем вам рефералка

| Цель | Как программа помогает |
|------|------------------------|
| **Привлечение гостей (demand)** | Каждый пользователь получает персональный код/ссылку; приглашённый получает welcome-бонус, вы — долю с его завершённых броней |
| **Привлечение партнёров (supply)** | За приглашённого хоста — фиксированный бонус активации из маркетингового резерва; растёт «уровень амбассадора» |
| **Контролируемый CAC** | Бонусы считаются **от маржи платформы по брони**, с жёстким потолком (не больше ~95% gross-комиссии на одну бронь) |
| **Удержание** | Часть бонусов — только на услуги (оплата сервисного сбора), часть — на вывод; tier повышает долю «к выводу» |
| **Маркетинговые кампании** | Promo Tank + Turbo Mode для временного усиления выплат без смены базовой формулы |

**Главная идея:** вы не платите «фиксированный процент от чека гостя». Вы **реинвестируете часть своей чистой маржи** с каждой завершённой брони — и только если у гостя был пригласивший.

---

## 2. Как это работает в одной схеме

```
Клик / ссылка / код
       ↓
Регистрация с валидным кодом → связь referrer ↔ referee + welcome-бонус приглашённому
       ↓
Бронь гостя → COMPLETED
       ↓
Расчёт пула из маржи → bonus (пригласившему) + cashback (приглашённому)
       ↓
Hold (по умолчанию 14 дней) → кошелёк → split «на вывод» / «на услуги»
       ↓
Пользователь тратит на checkout ИЛИ подаёт заявку на вывод → вы одобряете в админке
```

**Отдельная ветка (supply):** первая завершённая бронь у приглашённого **партнёра-хоста** → фиксированный бонус активации (по умолчанию 500 THB) списывается из **Promo Tank**, делится между L1 и L2 в цепочке приглашений.

---

## 3. Два типа заработка (важно не путать)

### 3.1 Брони приглашённых гостей (`guest_booking`)

- Триггер: бронь приглашённого перешла в статус **COMPLETED**.
- Платит **L1** (прямой пригласивший) + **L2** (наставник L1) + при live-флаге L3 — **L3** (дед в цепочке) + **cashback** приглашённому гостю.
- Сумма **не фиксирована**: зависит от комиссий платформы по конкретной брони и **Marketing Reinvestment %** (доля **чистой маржи владельца / Net Platform Margin** после waterfall → в referral pool).
- **L3** — не «всем дедам сразу»: только если `ambassador_guest_l3_enabled=true`, у бенефициара ≥10 прямых **PARTNER**, есть `referral_mlm_consent_at`, и есть hop в `ancestor_path`. Иначе доля L3 **не** перекладывается на L1/L2/гостя — withhold / shadow владельцу. **L4/L5 нет** до Stage 131.A2.

### 3.2 Активация приглашённого партнёра (`host_activation`)

- Триггер: **первая** COMPLETED-бронь на **любом** объекте приглашённого хоста (один раз на всю жизнь хоста).
- Фиксированная сумма из настроек **`partner_activation_bonus`** (дефолт **500 THB**).
- Деньги берутся из **Marketing Budget (Promo Tank)**, **не** из маржи брони и **не** с последующих заказов хоста.
- Делится между **L1** (кто пригласил хоста) и **L2** (наставник L1) — по умолчанию **70% / 30%**.

**Критично для экономики:** привёлший хоста **не** получает процент с броней «чужих» гостей на объектах этого хоста. Только разовый CAC supply.

### 3.3 Дерево приглашений (как связаны люди)

| Правило | Реализация |
|---------|------------|
| Один спонсор навсегда | `referral_relations.referee_id` — **UNIQUE**; сменить после регистрации нельзя |
| Цепочка при регистрации | `ancestor_path` + `network_depth` в `lib/referral/referral-network.js` |
| Анти-петли | `ReferralGuardService` блокирует, если новый пользователь уже в `ancestor_path` реферера |
| Лимит приглашений | Дефолт **~30 новых** рефералов / календарный месяц на аккаунт (`referral_monthly_limit_per_user`) |
| «Моя команда» в UI | Только **прямые** приглашённые (`referrer_id = я`), не весь downline |

**Монетизация по глубине (ADR-131A / Ambassador 3.1; live до cutover = ADR-131):**

| Событие | L1 (прямой) | L2 (наставник) | L3 (дед) | Referee |
|---------|-------------|----------------|----------|---------|
| Поездка гостя — **сейчас (flag off)** | **45%** пула | **12%** (caps 500 / 50k) | **0** (shadow withhold) | **43%** cashback |
| Поездка гостя — **после cutover (flag on)** | **42%** | **10%** (caps 500 / 50k) | **5%** (caps 500 / 20k; gate+consent) | **43%** |
| Первая бронь приглашённого хоста (`host_activation`) | ~70% от 500 THB | ~30% от 500 THB | **0** (без L3+) | — |

**Пример (цепочка вы → Борис → Катя едет):**  
С поездок Кати: **Борис** = L1, **вы** = L2. **L3** = кто пригласил вас — **0**, пока флаг L3 выключен; после cutover — 5% пула, если у этого человека ≥10 прямых партнёров и есть consent. Host activation по-прежнему только L1/L2 70/30.

---

## 4. Экономика одной брони (упрощённо)

**SSOT чисел runtime:** `system_fintech_settings` через `SystemConfigService` (админка FinTech / Ambassador + sync из Marketing). Канон: **ADR-131**, bootstrap `lib/config/fintech-config-defaults.js`.

| Параметр | Дефолт (launch) | Смысл |
|----------|-----------------|--------|
| **Marketing Reinvestment %** | **45%** | Доля *чистой маржи владельца (Net Platform Margin)* после waterfall → в реферальный пул |
| **Guest pool split (L2 on, L3 off — live сейчас)** | **45 / 12 / 43** | L1 / L2 / cashback referee от пула |
| **Guest pool split (L3 on — после cutover)** | **42 / 10 / 5 / 43** | L1 / L2 / L3 / cashback; сумма = 100% |
| **Legacy split ratio** | 0.5 | Fallback 50/50 L1↔referee, если L2 guest выключен флагом |
| **Safety cap** | 95% gross | Пул не может превысить 95% gross-комиссии платформы по брони |

**Пример (иллюстрация, не обещание суммы):**  
Gross-комиссия = 1 000 THB → после waterfall чистая маржа = 800 THB → reinvestment **45%** → пул ≈ **360 THB** → при live 45/12/43: L1 ~162 / L2 ~43 / referee ~155 THB. После cutover 42/10/5/43 те же ~360 делятся иначе (L3 ~18 THB при прошедшем gate).

Реальная цифра всегда из **`pricing_snapshot`** конкретной брони. Сверьте прод: **`/admin/settings/finances`** (Ambassador) / marketing settings sync.

### 4.1 L3 (Stage 131.A1+)

Третий уровень upline получает **5%** от referral pool при условиях:

- `ambassador_guest_l3_enabled = true` (operator-controlled)
- ≥ 10 прямых **PARTNER-**реферри у бенефициара (anti-fraud gate, тот же SSOT что tier)
- Явный consent пользователя (`profiles.referral_mlm_consent_at`)
- Per-booking cap **500 THB** + monthly cap **20 000 THB** per beneficiary (UTC)
- Неразмещённая доля → shadow в `bookings.metadata.fintech_snapshot.shadow_l3_thb` (не ledger, не program-cap spend)

Cutover с **45/12/0/43** на **42/10/5/43** — атомарный UPDATE в `system_fintech_settings` (`l1=42`, `l2=10`, `l3=5`, `referee=43`, `l3_enabled=true`, при необходимости `referral_monthly_program_cap_thb=1000000`). Делать **только** после Legal review disclosure и owner sign-off.

### Cutover checklist (Stage 131.A1 → live L3)

1. [ ] Legal review `/legal/public-offer/` §6 MLM disclosure — **получено**
2. [ ] На staging прогнаны тесты A1.1 + A1.2 + A1.3 (**17/17** pass; плюс cron-registry Stage 200 если трогали vercel.json)
3. [ ] Manual smoke: COMPLETED бронь с цепочкой A→B→C → L3 пишется, L1/L2 не сломаны
4. [ ] Owner sign-off зафиксирован
5. [ ] Атомарный UPDATE: l1=42, l2=10, l3=5, referee=43, l3_enabled=true
6. [ ] Мониторинг: 80% program cap alert в `/admin/settings/finances` — следить
7. [ ] Через 1 неделю: проверить что нет runaway, gate работает
8. [ ] Через 2 месяца: данные для решения о Stage 131.A2 (L4/L5)

---

## 5. Promo Tank (Marketing Budget)

| Что | Описание |
|-----|----------|
| **Баланс** | `marketing_promo_pot` в system settings |
| **Пополнение** | Ручной top-up в админке; % с **органических** броней (`organic_to_promo_pot_percent`) |
| **Turbo Mode** | Доп. фикс. THB на каждую реферальную бронь (`promo_boost_per_booking`), пока в tank есть деньги |
| **Расход** | Turbo boost; **host activation** (весь бонус активации) |
| **Guest pool** | Базовый пул с маржи **не списывается** из tank — это учётное обязательство платформы |

**Быстрый запуск кампании (~1 мин):**  
1) Пополнить tank → 2) Включить Turbo + задать boost → 3) Дать аудитории ссылку с ref-кодом.

---

## 6. Уровни амбассадора (tier)

Считаются **прямые приглашённые партнёры** (role = PARTNER), не просто регистрации гостей.

| Уровень | Порог (дефолт) | Доля бонуса «к выводу» |
|---------|----------------|-------------------------|
| **Beginner** | 0 партнёров | 60% |
| **Pro** | 5 партнёров | 75% |
| **Ambassador** | 20 партнёров | 85% |

Остальная часть `referral_bonus` → **внутренние кредиты** (оплата сервисного сбора на сайте).

- Глобальный fallback без tier: **`payout_to_internal_ratio`** (дефолт **70%** к выводу) — в коде поле названо исторически, по смыслу это **% withdrawable**.
- **Cashback** и **welcome-бонус** — **100% только на услуги**, не на вывод.
- Понижение tier откладывается на **30 дней** (grace), если метрики упали.

Таблица tier: `referral_tiers` (можно менять пороги и проценты через БД; UI tier — в аналитике).

---

## 7. Hold, clawback, антифрод

| Механизм | Дефолт / поведение |
|----------|-------------------|
| **Hold-период** | 14 дней (`referral_hold_days`) после COMPLETED — статус `earned_held`, потом cron разблокирует в кошелёк |
| **Отмена до earned** | pending → canceled |
| **Отмена после earned** | clawback с кошелька + ledger canceled |
| **Self-referral** | блок: тот же user/email/IP владельца кода |
| **Device fingerprint** | один fingerprint — коды разных рефереров не активировать |
| **Лимит регистраций** | max **30** новых рефералов на реферера в календарном месяце (TZ профиля реферера) |
| **Fraud queue** | `/admin/marketing/fraud-queue` — ручной разбор подозрительных |

---

## 8. Вывод денег пользователям

**Автовыплат на банк нет** — полуавтомат:

1. Пользователь: заявка (`POST /api/v2/wallet/referral-withdrawal-request`) — только **withdrawable** баланс.
2. Условия: min сумма (дефолт **1000 THB**), верификация email / payout flag.
3. Вы: **`/admin/marketing/payouts?referralOnly=1`** — approve/reject, bulk API.
4. Фактический перевод — ваш существующий payout rail (не смешивать с promo tank).

---

## 9. Где управлять и смотреть (админка)

| URL | Зачем |
|-----|--------|
| **`/admin/marketing/settings`** или **`/admin/system` → Маркетинг** | Все ключевые %: reinvestment, split, welcome, hold, MLM, turbo, wallet policy |
| **`/admin/marketing/budget`** | Promo Tank |
| **`/admin/marketing/analytics`** | Воронка, LTV vs cost, cohort ROI, tier-статистика |
| **`/admin/marketing/attribution`** | Клики → регистрации → первая бронь (Phase 2.0) |
| **`/admin/marketing/campaigns`** | Кампании с slug, бюджетом, override hold |
| **`/admin/marketing/reward-rules`** | Версионированные A/B правила начисления |
| **`/admin/marketing/fraud-queue`** | Очередь подозрительных |
| **`/admin/marketing/payouts`** | Очередь заявок на вывод |
| **`/admin/marketing/roi`** | ROI по кампаниям |
| **`/admin/settings/finances`** | **ReferralLiabilityPanel** — earned vs withdrawable, экспорт ledger, месячные алерты |

**Ежедневный чеклист FinOps:**
- ledger earned vs сумма withdrawable в кошельках;
- баланс promo tank vs прогноз host activations;
- алерты FINANCE в Telegram (крупное earned, burst за час, месячный spend).

---

## 10. Что видит пользователь

| Страница | Назначение |
|----------|------------|
| **`/profile/referral`** | Код, ссылка, PDF-визитка, заработок, команда, история, вывод |
| **`/profile/status`** | Статус амбассадора, withdrawable strip |
| **`/u/{userId}`** | Публичная визитка амбассадора |
| **`/about/loyalty`** | Холодная аудитория — welcome-бонус и правила |
| **`/?ref=CODE`** | Лендинг с сохранением кода до регистрации |

Партнёры используют **тот же** `/profile/referral` (старый `/partner/referrals` редиректит).

---

## 11. Welcome-бонус

- Настройка: **`welcome_bonus_amount`** (в UI часто показывается **500 THB**, если не задано иначе).
- Начисляется **приглашённому** при регистрации с **валидным** кодом.
- Срок жизни: **30 дней**; неиспользованный возвращается в promo tank.
- Тратится только на **сервисный сбор** при checkout (не уменьшает выплату хосту).

---

## 12. Кампании и правила (Phase B, уже в проде)

- **Кампании** привязываются к `referral_codes.campaign_slug`: можно задать бюджет, срок, другой hold.
- **Reward rules** — версионированные правила (split, min booking, hold); есть shadow/production режим.
- Атрибуция кликов: **`referral_attributions`** + track API (до регистрации).

---

## 13. Ограничения и риски (честно)

1. **Guest L3 — код готов, live выключен** (ADR-131A): с поездок платит L1 + L2 (+ cashback); L3 ledger только после cutover (`ambassador_guest_l3_enabled=true`) + gate + consent. Host activation L1/L2 **70/30** — без L3+. L4/L5 — Stage 131.A2 после gate §5.
2. **Базовый guest pool не резервируется в tank** — это обязательство из маржи; при массовом выводе нужен cash-flow контроль.
3. **Clawback** не на всех путях отмены брони (основной — cancel API).
4. **OAuth:** невалидный ref-код при Google-регистрации **молча отбрасывается** (регистрация без реферала).
5. **Дефолты в коде ≠ прод** — сверяйте **`system_fintech_settings`** (FinTech Ambassador panel); launch reinvestment **45%**, не путать с устаревшими гайдами на 70%.

---

## 14. Вопросы к вам (чтобы довести продуктовую политику)

1. **Какие сейчас фактические значения** reinvestment %, welcome, hold и min payout **на airento.ru**? (В коде дефолты, на Vercel могут быть другие.)
2. **Вывод на карту/счёт уже включён** для пользователей или только заявка + ручная обработка?
3. **Guest MLM L3** — принято в ADR-131A; live после Legal + owner cutover. L4/L5 — не раньше Stage 131.A2.
4. **Целевой CAC/LTV** — под них стоит ли подкрутить reinvestment или turbo, или оставить launch **45%** (ADR-131: выше 60% только при LTV/CAC ≥ 1.2)?
5. **Публичная оферта рефералки** — есть ли отдельный юр. текст для пользователей, или опираемся на `/about/loyalty` + terms?

---

## 15. Связанные документы в репозитории

| Файл | Для кого |
|------|----------|
| `docs/BUSINESS_LOGIC_REFERRAL.md` | Формулы и policy (EN) |
| `docs/REFERRAL_FINANCIAL_FLOW.md` | FinOps, ledger, wallet |
| `docs/REFERRAL_ACCOUNTING.md` | Бухгалтерские KPI |
| `docs/REFERRAL_PROGRAM_2_0_PLAN.md` | Roadmap 2.0 |
| `docs/ADR/131-ambassador-3-0.md` | **Accepted:** Ambassador 3.0 — L2 guest Live, waterfall, reinvestment **45%**, caps |
| `docs/ADR/131A-ambassador-3-1-multi-level.md` | **Accepted:** Ambassador 3.1 — guest L3 42/10/5/43, cap 1M (после cutover); L4/L5 = A2 |
| `docs/REFERRAL_CURRENT_AUDIT.md` | Техаудит as-is |

---

*При расхождении поведения с этим документом истина — код + `ARCHITECTURAL_DECISIONS.md`.*
