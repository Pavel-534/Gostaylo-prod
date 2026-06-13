# Release checklist — RU referral & host contour

**Version:** Phase 132.3 · **v12.132.3** · 2026-06-13

Краткий чек-лист перед прод-деплоем первого RU-контура (амбассадоры + хосты + FinTech Bridge).

## 1. База и миграции

- [ ] Применены `stage131_6` и `stage131_7` (проверка: колонки `payouts.payout_rail`, `partner_payout_profiles.payout_fingerprint`, `profiles.metadata`).
- [ ] Security Advisor Supabase — без критичных RLS/grant предупреждений на новых таблицах.

## 2. FinTech и выплаты

- [ ] `npm run smoke:full-financial` → **28/28 GREEN** (включая **12f** FinTech Bridge и **12g** FraudGate).
- [ ] Admin desk `/admin/marketing/referral-payouts`: очередь → approve → реестр Т-Банка → PAID.
- [ ] Уведомления пользователю: **одобрено** → **реестр в банке** → **выплачено** (email / push / in-app баннер на `/profile/wallet`).

## 3. Продуктовый поток (ручной QA)

- [ ] Шаринг `/u/[id]` или `/go/[vanity]` — OG-превью с dual CTA (гость + хост).
- [ ] Регистрация хоста по реф-ссылке → `PartnerReferralWelcomeStrip` на dashboard.
- [ ] Мастер `/partner/listings/new` → `PartnerReferralWizardBanner` (до первой брони).
- [ ] `/profile/referral` — Guest/Host tabs, mentor strip, RU dual-currency в шаблонах.
- [ ] `/profile/wallet` — реквизиты РФ, waterfall, sticky «Вывести» на мобильном (360px).

## 4. Конфигурация окружения

- [ ] `system_fintech_settings` — referral knobs только через FinTech SSOT (не legacy `system_settings.general`).
- [ ] YooKassa / Controlled Live — по `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` (если включены MIR).
- [ ] Push: `firebase-messaging-sw.js` + FCM tokens для тестового амбассадора.

## 5. Документация

- [ ] `docs/TECHNICAL_MANIFESTO.md` — **Stage 132.3**.
- [ ] `docs/ARCHITECTURAL_PASSPORT.md` — **v12.132.3**.

## 6. Rollback plan

- [ ] FinTech pause / emergency toggle задокументирован в runbook.
- [ ] Откат UI-only деплоя не требует down-migration (миграции 131.6/131.7 обратно не откатывать без ops).

---

**Sign-off:** _________________ · Date: ___________
