# Treasury RF–KR Phase 0 — local template (no secrets)

**Copy this file out of git** (or keep a filled copy only under `docs/private/` which is gitignored except `*.example.md`).

Policy SSOT: [`docs/ADR/300-russia-kyrgyzstan-thailand-3.0.md`](../ADR/300-russia-kyrgyzstan-thailand-3.0.md).  
Product payout mechanics: [`docs/runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`](../runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md).

Fill placeholders locally. **Do not commit** INN, accounts, ShopID, wallet addresses, or buffer sizes.

---

## Entities (local)

| Role | Placeholder |
|------|-------------|
| RF agent (cash-in) | `{RF_AGENT_LEGAL_NAME}` |
| KR IT company (when incorporated) | `{KR_LEGAL_NAME}` |
| Brand / product | `{BRAND}` = `getSiteDisplayName()` / env, not a hardcoded legacy name |

---

## Phase 0 checklist (treasurer)

1. Guest paid → booking snapshot + ledger exist (admin booking / finances).
2. Partner eligible → `READY_FOR_PAYOUT` / batch DRAFT → Lock → CSV (admin finances).
3. **Physical send** (RUB registry **or** USDT from RF treasury). Record tx id / bank statement locally.
4. Mark batch **settled** in admin only after cash actually left.
5. If RF→KR remittance happens later: book it in your accountant file; optional FinTech «Конвертации и потери» for FX. No product remittance screen.

---

## Payment purpose (draft locally)

Keep real bank templates **off git**. Example shape only:

- Host RUB: `{PURPOSE_HOST_PAYOUT}` + `{BOOKING_OR_BATCH_ID}`
- KR IT (when remitting): `{PURPOSE_IT_SERVICES}` — **IT / support**, not royalty wording
- Do not paste unique contract / УНК strings into the public repo

---

## USDT buffer (local only)

`{TREASURY_BUFFER_POLICY}` — size, wallet, and replenishment rules stay in the private copy.

Phase 0: buying USDT in RF and paying a foreign host from that wallet is **allowed** by ADR-300 until a successor ADR says otherwise.

---

## Fiscal / acquiring env (not in this file)

Use deployment secrets / env dashboard: `FISCAL_*`, acquirer ShopID, kassa tokens. Never duplicate values here into git.
