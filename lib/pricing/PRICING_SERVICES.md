# Pricing modules — SSOT map (Stage 108.5)

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

**Запрещено:** пересчитывать guest total на confirm без snapshot. **Витрина:** `lib/pricing/guest-display-price.js`.
