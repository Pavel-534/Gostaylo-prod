# Pricing modules — SSOT map (Stage 108.5, FX **110.4**)

Не объединяем в один файл: разные домены. Импортируйте **только** нужный модуль.

| Модуль | Алиас (108.5) | Назначение | Когда использовать |
|--------|---------------|------------|-------------------|
| `lib/services/pricing.service.js` | **`PricingCatalogService`** (= `PricingService`) | Дневные цены, сезоны, комиссии, промо, `calculateBookingPrice` | Каталог, календарь партнёра, create booking, админ-симулятор |
| `lib/services/booking/pricing.service.js` | **`BookingSettlementPricing`** (объект функций) | `pricing_snapshot` на брони (`settlement_v3`, FX lock) | После создания брони, checkout, partner financial read-model |

```js
import PricingService, { PricingCatalogService } from '@/lib/services/pricing.service'
import { BookingSettlementPricing } from '@/lib/services/booking/pricing.service'

// Каталог — любой из двух имён:
await PricingCatalogService.calculateBookingPrice(...)

// Бронь после оплаты:
await BookingSettlementPricing.attachSettlementSnapshotForBooking(bookingId)
```

**Запрещено:** пересчитывать guest total на confirm без snapshot.

---

## Два слоя «цены для гостя» (не смешивать)

| Слой | Что это | SSOT | Где |
|------|---------|------|-----|
| **Guest service fee %** | Процент поверх партнёрской базы **в THB** (витрина, поиск, PDP hero) | `lib/pricing/guest-display-price.js` | Карточки, search min/max, SEO, wizard `storefrontGuestDisplayThb` |
| **Retail FX markup** | Спред при конвертации THB → USD/RUB/… (`chatInvoiceRateMultiplier` на `rateMap`) | `lib/pricing/fx-display.js` + `CurrencyService.getDisplayRateMap({ applyRetailMarkup })` | Каталог в выбранной валюте, PDP hero в валюте UI, wizard preview в `baseCurrency` |

**Settlement / `pricing_snapshot` / ledger / payout preview** — только **mid** FX (`retail=0`, `getMidMarketDisplayRateMap`, `getRawRateMap` в `pricing-fx-helpers.js`). Не подставлять витринный `rateMap` в breakdown брони.

### `fx-display.js` / `fx-display-client.js` (Stage 110.4)

- **Клиент:** `fx-display-client.js` — `getDisplayPriceInCurrency`, `formatDisplayPriceInCurrency`, wizard preview (без Supabase).
- **Сервер:** `fx-display.js` — `getStorefrontDisplayRateMap()` / `getMidMarketDisplayRateMap()`, `parseRetailFxQueryParam`.
- `computeWizardStorefrontPricePreview` — wizard: guest fee в THB + конвертация в `listingBaseCurrency` через **retail** `rateMap` (не `THB × multiplier` для кросс-валюты).

### API курсов

`GET /api/v2/exchange-rates?retail=1` (default) — витрина; `?retail=0` — mid. Клиент: `fetchExchangeRates({ retail: true|false })` — отдельные cache keys в `lib/client-data.js`.
