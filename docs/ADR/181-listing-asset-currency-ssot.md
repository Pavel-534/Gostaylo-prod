# ADR-181: Listing Asset Currency SSOT — multi-market pricing (RU / TH)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** (Product + Finance + Engineering, 2026-07-13) |
| **Stage** | **181.0** (policy + phased implementation) |
| **Date** | 2026-07-13 |
| **Deciders** | Product owner, Finance, Engineering |
| **Related** | Stage 110.4 (retail vs mid FX), Stage 180.1–180.6 (partner display FX), ADR-097, `lib/pricing/guest-display-price.js`, `lib/services/pricing/pricing-fx-helpers.js` |
| **SSOT after adoption** | This ADR + `ARCHITECTURAL_DECISIONS.md` (§ ADR-181) + `docs/TECHNICAL_MANIFESTO.md` + `docs/ARCHITECTURAL_PASSPORT.md` |

---

## 1. Context

### 1.1. Продуктовая цель

Запуск **в нескольких странах** (Таиланд, Россия и далее) без путаницы:

- хост вводит цену **в валюте объекта** (Сочи → ₽, Пхукет → ฿);
- гость видит **витринную** цену (база + guest service fee + retail FX при кросс-валюте);
- платформа ведёт **единый ledger в THB**;
- партнёр видит доходы в **валюте шапки** (mid FX, Stage 180) и получает выплату в **payout rail** (server preview).

Референс индустрии (Airbnb, Booking.com): **listing currency = валюта локации актива**; guest UI currency ≠ listing currency; internal settlement — одна книга.

### 1.2. As-is (код, после Stage 180.6)

| Слой | Поведение | Проблема |
|------|-----------|----------|
| **Wizard input** | Партнёр выбирает `base_currency` вручную; вводит число в поле `basePriceThb` | UX говорит «в валюте листинга», но поле называется `*_thb` |
| **Save API** | `PATCH /api/v2/partner/listings/[id]` пишет число в `listings.base_price_thb` **без конвертации** | При `base_currency=RUB` и вводе `2000` движок цен может трактовать `2000` как **THB-субтотал**, не как ₽ |
| **Pricing engine** | `PricingService.calculateBookingPrice*` читает `base_price_thb` как субтотал в THB-контуре | Корректно для TH; **риск для RU** |
| **Display (partner)** | Stage 180: asset currency primary + header `≈` mid | ✅ Отображение улучшено; **не чинит канон сохранения** |
| **Display (guest)** | Retail FX + `guestServiceFeePercent` | ✅ Канон Stage 110.x |
| **Geo** | `GeoService.COUNTRY_CURRENCY_MAP`: RU→RUB, TH→THB | Только для **гостевой** UI-валюты, не для листинга |
| **Две комиссии** | `guestServiceFeePercent` (с гостя, дефолт **5%**) vs `hostCommissionPercent` (с хоста, часто **15%** из `defaultCommissionRate`) | Партнёры путают «+15% на сайте» с guest fee |

### 1.3. Пример (Сочи, 2000 ₽)

**Желаемое поведение:**

| Роль | Видит |
|------|--------|
| Хост | База **2 000 ₽**/ночь |
| Гость (RU, RUB) | **~2 100 ₽** (2000 + 5% guest fee; без FX markup — валюты совпали) |
| Хост net | **~1 700 ₽** (2000 − 15% host commission на субтотале) |
| Ledger | Субтотал **X THB** (mid на момент save/booking), снимок в `pricing_snapshot` |

**Сейчас без Wave 1:** 2000 в `base_price_thb` при `base_currency=RUB` — семантический разрыв.

---

## 2. Decision summary

### 2.1. Три слоя цены (норматив, не смешивать)

```text
┌─────────────────────────────────────────────────────────────┐
│  L1 ASSET (partner input)     base_currency + asset amount  │
│  L2 STOREFRONT (guest catalog)  L1 + guest fee % + retail FX│
│  L3 LEDGER (platform book)      всё в THB + booking snapshot│
└─────────────────────────────────────────────────────────────┘
```

| Слой | SSOT | FX |
|------|------|-----|
| **L1 Asset** | `listings.base_currency` + **asset amount** (см. §2.2) | Нет |
| **L2 Storefront** | `lib/pricing/guest-display-price.js` + retail `rateMap` | `retail: true` |
| **L3 Ledger** | `bookings.price_thb`, `pricing_snapshot`, escrow | **mid** only (`retail: false`) |

**Запрещено:** применять retail FX к partner ledger / escrow / payout preview (Stage 180).

### 2.2. Канон хранения цены листинга

**`listings.base_price_thb`** остаётся **единственным числом для PricingService** — всегда **THB-эквивалент** субтотала за единицу (ночь/сутки) по **mid** курсу на момент сохранения.

Параллельно сохраняем **исходный ввод партнёра** для round-trip UI:

```json
// listings.metadata (канон до отдельной колонки)
{
  "base_price_asset": {
    "amount": 2000,
    "currency": "RUB",
    "rate_thb_per_unit_mid": 2.85,
    "converted_at": "2026-07-13T12:00:00.000Z"
  }
}
```

**Правила:**

1. Партнёр **редактирует только** `amount` в `base_currency` (L1).
2. На **create/patch** listing API: `base_price_thb = round(asset_amount × mid_rate[base_currency])`.
3. При **load** wizard/edit: UI показывает `metadata.base_price_asset.amount` если валюта совпадает; иначе fallback `convertThbToDisplayAmountRounded(base_price_thb, base_currency, midMap)` + бейдж «курс обновлён».
4. **Seasonal prices** в metadata — в **той же asset currency**, конвертация в THB при save сезона (или при booking calc — Wave 2).

**Альтернатива (отклонена на Wave 1):** переименовать колонку `base_price_thb` → `base_price_amount` — слишком широкая миграция; metadata + SSOT write path достаточны.

### 2.3. Привязка `base_currency` к локации

| Правило | Деталь |
|---------|--------|
| **Default** | `base_currency` = `countryCodeToListingCurrency(listing.country_code)` |
| **Маппинг SSOT** | Новый модуль `lib/listing/listing-asset-currency.js` (не путать с guest `GeoService`) |
| **Стартовый маппинг** | `RU`→`RUB`, `TH`→`THB`, `US`→`USD`; прочие → `THB` или `USD` по ADR-таблице в коде |
| **Override** | Партнёр может сменить до первой брони (§2.5); после — read-only + support |
| **Не привязывать** | к валюте шапки партнёра / гостя |

Wizard: при выборе страны/города — **pre-fill** `base_currency` + подсказка «Цены объекта в {currency} — валюта локации».

### 2.4. Две комиссии — один explainer (продукт)

| Термин | Кто платит | SSOT | Типичное значение |
|--------|------------|------|-------------------|
| **Guest service fee** | Гость | `guestServiceFeePercent` | **5%** (`PLATFORM_SPLIT_FEE_DEFAULTS`) |
| **Host commission** | Партнёр (с субтотала) | `hostCommissionPercent` / `custom_commission_rate` | **15%** (`defaultCommissionRate`) |

Wizard / preview **обязаны** показывать три строки (см. Wave 3):

1. **Ваша цена** — L1 asset  
2. **Цена для гостя на сайте** — L2 storefront (retail)  
3. **Ваш доход с брони** — L1 − host commission (не путать с L2)

### 2.5. Immutability `base_currency`

После **первой оплаченной или подтверждённой брони** по листингу:

- `base_currency` **нельзя менять** (API 409 `LISTING_BASE_CURRENCY_LOCKED`);
- asset amount можно менять (пересчёт `base_price_thb`).

Исключение: `ADMIN` patch.

### 2.6. FX при оплате (без изменений ADR)

`getCheckoutRateToThb(payment_currency, listing_base_currency)`:

- `payment === listing_base` → **без retail markup** на кросс-курс;
- иначе → mid с делением на `chatInvoiceRateMultiplier`.

Это уже канон Stage 110.4 — **не меняем** в ADR-181.

---

## 3. Options considered

| Option | Описание | Verdict |
|--------|----------|---------|
| **A — Только UI (Stage 180)** | Показывать валюту, не чинить save | ✅ Сделано; **недостаточно для RU** |
| **B — Convert on save + metadata asset** ✅ | `base_price_thb` THB canon + `metadata.base_price_asset` | **Accepted** |
| **C — Отдельные колонки `base_price_amount`** | Чище схема, нужна миграция | **Defer** (Wave 5+ если metadata не хватит) |
| **D — Всё в THB, хост вводит баты** | Проще код | **Reject** для RU launch |

---

## 4. Implementation plan (waves)

### Wave 0 — ADR + docs (этот PR)

| Task | Files |
|------|-------|
| ADR-181 | `docs/ADR/181-listing-asset-currency-ssot.md`, `ARCHITECTURAL_DECISIONS.md` |
| Passport / manifest | Краткий Stage 181.0 planned |

**Exit:** PR checklist ссылается ADR-181.

---

### Wave 1 — Server canon on save (**P0, блокер RU**)

| Task | Detail |
|------|--------|
| **1.1 SSOT module** | `lib/listing/listing-base-price-canon.js`: `resolveListingBasePriceCanon({ amount, currency, rateMap })` → `{ basePriceThb, basePriceAsset }` |
| **1.2 Rates** | Mid map: `getMidMarketDisplayRateMap()` / `pricing-fx-helpers.getRawRateMap()` на сервере |
| **1.3 API write** | `POST/PATCH` partner listings: перед upsert конвертировать; писать `metadata.base_price_asset` |
| **1.4 API read** | Partner listing GET: отдавать `basePriceAsset` + `basePriceThb` явно |
| **1.5 Wizard load** | `listing-wizard-load-existing.js`: приоритет `metadata.base_price_asset.amount` |
| **1.6 Tests** | Unit: RUB 2000 @ rate 2.85 → base_price_thb 5700; THB passthrough |

**Files:** `app/api/v2/partner/listings/route.js`, `[id]/route.js`, `lib/listing/listing-base-price-canon.js`, `lib/validations/listing.js`, `__tests__/listing-base-price-canon.test.js`

**Exit:** Создание листинга RU с 2000 RUB → `base_price_thb` = THB-эквивалент; pricing engine согласован.

---

### Wave 2 — Auto `base_currency` from location (**P0 UX**) ✅ Stage 181.2

| Task | Detail | Status |
|------|--------|--------|
| **2.1 SSOT map** | `lib/listing/listing-asset-currency.js`: `getDefaultListingBaseCurrency(countryCode)`, `resolveEnforcedListingBaseCurrency` (RU hard invariant) | ✅ |
| **2.2 Server invariant** | `lib/listing/apply-listing-base-currency-invariant.js` on partner listings POST/PATCH after geo snapshot (`LISTING_BASE_CURRENCY_AUTO`, default on) | ✅ |
| **2.3 Wizard** | При смене `country` / geocode → предложить `base_currency` (confirm chip, не silent overwrite если уже введена цена) | pending |
| **2.4 Draft create** | `ensure-wizard-draft-listing.js`: default from country | pending |
| **2.5 i18n** | `wizardBaseCurrencyLocationHint`: «Валюта объекта определяется страной расположения» | pending |

**Exit:** Сочи → `RUB` на save; Пхукет → `THB`. Server-side enforced; wizard UX chips — Wave 2.3–2.5 backlog.

---

### Wave 3 — Wizard three-line pricing explainer (**P1**)

| Task | Detail |
|------|--------|
| **3.1 Component** | `PartnerListingPricingExplainer` — три карточки L1 / L2 / L3-lite |
| **3.2 StepPricing** | Заменить разрозненные блоки на explainer + ссылка «Как считается цена» |
| **3.3 i18n** | `wizardPricing_layerAsset`, `_layerGuest`, `_layerNet`, `wizardPricing_feeLegend` |
| **3.4 Retail preview** | L2 через `useStorefrontDisplayFx` (уже Stage 180.6) |

**Exit:** Партнёр видит 2000 ₽ → ~2100 ₽ гость → ~1700 ₽ net в одном блоке.

---

### Wave 4 — Lock `base_currency` / base price on active bookings (**P1**) ✅ Stage 181.4

| Task | Detail | Status |
|------|--------|--------|
| **4.1 Guard** | `lib/listing/listing-financial-lock.js` — `checkListingFinancialLock`, `detectAttemptedListingFinancialChange`, `assertListingFinancialEditAllowed`; blocking statuses in `LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES` | ✅ |
| **4.2 API** | Partner PATCH `listings/[id]` → `400` + `LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS` (geo→currency dry-run included) | ✅ |
| **4.3 UI** | Select disabled + tooltip в wizard edit | pending |

**Exit:** PATCH смена RUB→THB при `CONFIRMED` брони → `400`. `INQUIRY`, `THAWED`, `READY_FOR_PAYOUT`, `COMPLETED` не блокируют.

---

### Wave 5 — Backfill + seasonal canon (**P2**) — partial ✅ Stage 181.5

| Task | Detail | Status |
|------|--------|--------|
| **5.1 Migration script** | `migrations/stage181_5_ru_listing_base_price_asset_backfill.sql` — RU listings missing `metadata.base_price_asset`: derive RUB from `base_price_thb / rate_to_thb`; sets `base_currency=RUB`; idempotent | ✅ |
| **5.2 Seasonal** | Seasonal `priceDaily` в asset currency; THB при save в `seasonal_prices` или calc-time | pending |
| **5.3 Optional column** | Оценить `listings.base_price_asset_amount` если metadata churn высокий | defer |

**Exit:** Нет RU листингов с пустым `metadata.base_price_asset` после применения миграции. **Caveat:** если legacy `base_price_thb` хранил RUB amount (не THB canon), backfill даст неверный `asset.amount` — отдельная remediation.

---

## 5. Partner & platform accounting (как не запутаться)

### Партнёр видит

| Экран | Что | FX |
|-------|-----|-----|
| Wizard / calendar inputs | Asset currency (L1) | Нет |
| Listings card | Asset + `≈` header | Mid |
| Finances / bookings | THB ledger → header | Mid |
| Payout preview | Server payout currency | Payout rail |

**Правило UX:** подпись «Суммы в {headerCurrency} ориентировочные, расчёт в THB» (`stage180_midFxHint`) — уже есть.

### Платформа ведёт

- **Операционная книга:** THB (`ledger_entries`, `bookings.*_thb`).
- **Налог / compliance:** snapshot на бронь (`pricing_snapshot`), не пересчитывать задним числом.
- **Курс на бронь:** `exchange_rate`, `listing_currency`, `net_amount_local` на строке booking.
- **Не смешивать:** retail markup → только guest-facing; mid → ledger и partner obligation.

---

## 6. API / error codes (new)

| Code | HTTP | When |
|------|------|------|
| `LISTING_BASE_CURRENCY_LOCKED` | 409 | PATCH `baseCurrency` after first booking |
| `LISTING_BASE_PRICE_FX_UNAVAILABLE` | 503 | Mid rate missing for asset currency |
| `LISTING_BASE_CURRENCY_COUNTRY_MISMATCH` | 400 | Optional strict mode (Wave 2+, feature flag) |

---

## 7. Testing checklist

- [ ] Unit: canon RUB/THB/USD/USDT round-trip  
- [ ] Integration: create RU listing → search card guest price ≈ asset + guest fee  
- [ ] Integration: booking RUB listing + RUB pay → no FX markup line in snapshot  
- [ ] Integration: booking RUB listing + USD pay → fx_markup present  
- [ ] Partner UI: wizard explainer three lines  
- [ ] Regression: TH listings unchanged (THB passthrough rate 1)  
- [ ] `npm run build` + financial smoke if touched booking path  

---

## 8. Non-goals (ADR-181)

- Мультивалютные **payout** правила (уже ADR Stage 100.6).
- Смена ledger currency с THB.
- Автоматическое pricing по конкурентам.
- CNY как `base_currency` листинга (только payment currency гостя).

---

## 9. Rollout / flags

| Flag | Purpose |
|------|---------|
| `LISTING_ASSET_PRICE_CANON=1` | Wave 1 server convert on save |
| `LISTING_BASE_CURRENCY_AUTO=1` | Wave 2 geo default |
| `LISTING_BASE_CURRENCY_LOCK=1` | Wave 4 immutability |

Порядок включения на prod: **1 → 2 → 3 → 4 → 5**.

---

## 10. Success metrics

- 0 новых листингов с `base_currency=RUB` и `base_price_thb` = сырой ввод без THB-конвертации (после Wave 1).
- Снижение support-тикетов «в какой валюте вводить цену».
- Расхождение guest checkout vs wizard preview < 1% (retail parity).
