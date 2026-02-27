# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27 - Mobile Optimization & Full Russification ✅

### Mobile UI Optimization (P0) ✅
- **System Control Center** теперь полностью responsive
- Одноколоночный layout для мобильных устройств
- Toggle и кнопки не выходят за границы экрана
- `max-w-full` и proper padding на всех элементах

### Full Russification (P0) ✅
Полная русификация Центра управления:
- "System Control Center" → "Центр управления"
- "Maintenance Mode" → "Режим обслуживания"
- "Global kill switch" → "Глобальный выключатель публичного сайта"
- "Telegram Bot Webhook" → "Вебхук Telegram-бота"
- "Platform is fully operational" → "Платформа полностью функциональна"
- "Online/Offline" → "Онлайн/Офлайн"
- "Pending updates" → "Ожидающие обновления"
- "Activity Log" → "Журнал активности"
- "Test Connection" → "Тест связи"

### Webhook Diagnostics (P0) ✅
- **"Тест связи"** кнопка — проверяет соединение с Telegram API
- **"Отправить Aloha"** — отправляет приветственное сообщение напрямую
- **💡 Диагностика** блок с советами:
  - 502 ошибка = сервер перезапускается
  - Используйте "Тест связи" для проверки
  - Кнопка "Aloha" отправляет сообщение напрямую
- Webhook переподключён успешно (0 pending, no errors)

### UI Polish ✅
- 🌴 Palmtree иконка в заголовке
- Premium Tropical gradient cards
- Consistent design на Admin и Partner dashboards
- Mobile-first responsive layout

## Previous Updates

### Admin System Control Center ✅
- Maintenance Mode kill switch
- Telegram Webhook Management
- Recent Activity Log
- Quick Stats cards

### Global Translations ✅
- Removed duplicate footer
- Single localized footer per page
- Languages: RU, EN, ZH, TH

### Bot Edge Runtime ✅
- Webhook on Edge Runtime
- Direct Supabase API calls
- "Aloha!" response working

## Working Features
1. ✅ **System Control Center** — Полная русификация + mobile-first
2. ✅ **Homepage** — Full localization
3. ✅ **Listings Page** — Prices, stats, translations
4. ✅ **Telegram Bot** — Edge Runtime, Aloha working
5. ✅ **Admin Panel** — Premium design, no overlap

## Next Priority Tasks
1. 🔴 **P0: Real Authentication** — текущий логин MOCK
2. 🟡 **P1: iCal Sync Backend** — Parse/block dates
3. 🟡 **P1: Localize 404 pages**

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | any |
| Partner | partner@test.com | any |

## Tech Stack
- **Framework:** Next.js 14.2.3
- **Database:** Supabase PostgreSQL  
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI
