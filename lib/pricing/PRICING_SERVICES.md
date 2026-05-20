# Pricing modules — SSOT map (Stage 108.2)

Не объединяем в один файл: разные домены. Импортируйте **только** нужный модуль.

| Модуль | Назначение | Когда использовать |
|--------|------------|-------------------|
| `lib/services/pricing.service.js` | **PricingService** — дневные цены, сезоны, комиссии, промо, `calculateBookingPrice` | Каталог, календарь партнёра, create booking, админ-симулятор |
| `lib/services/booking/pricing.service.js` | **Settlement / `pricing_snapshot`** на брони (`settlement_v3`, FX lock) | После создания брони, checkout, partner financial read-model |

**Запрещено:** пересчитывать guest total на confirm без snapshot. **Витрина:** `lib/pricing/guest-display-price.js`.
