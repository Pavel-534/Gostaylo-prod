# Archived: `app/api/cron/payouts/route.js` (removed from App Router)

Снимок логики на момент удаления (для git blame см. историю файла).

- `POST` → всегда **503** + `disabled: true` (автовыплаты отключены, PR-#2).
- `GET` (с `CRON_SECRET`) → JSON: `readyForPayoutLegacy`, `upcomingThaw`, `policy`; query `?action=preview-thaw` → `EscrowService.notifyUpcomingThaw()`.

Замена: **`POST /api/cron/escrow-thaw`** + партнёрские **Request Payout**.
