# Partner KYC → PARTNER role (smoke, no SQL)

Канонические шаги совпадают с `lib/runbooks/partner-kyc-e2e-smoke.js` и JSON `runbook` из **`GET /api/v2/debug/test-telegram`**.

1. Арендатор: **`/renter/profile`** → заявка партнёра → загрузка KYC → отправка.  
2. Telegram: топик **NEW_PARTNERS** (thread **17**) в админ-группе — сообщение о заявке (нужны **`TELEGRAM_BOT_TOKEN`**, **`TELEGRAM_ADMIN_GROUP_ID`**).  
3. Админ: **`/admin/partners`** → карточка → просмотр KYC через **`/api/v2/admin/verification-doc`** (редирект на signed URL) → **Одобрить**.  
4. Пользователь: обновить сессию / перелогин → **`GET /api/v2/auth/me`** с ролью **PARTNER** → **`/partner/dashboard`**.  
5. Проверка канала: **`GET /api/v2/debug/test-telegram`** (только **ADMIN**; в production — **`ENABLE_DEBUG_TELEGRAM=1`**) → в группу уходит **«Test OK»**.

Ledger: при первом проведении **`BOOKING_PAYMENT_CAPTURED`** (DEBIT на clearing) в топик **FINANCE** уходит краткое уведомление.
