# ADR-210: Concierge Supply Pipeline — cold-start listings (M2.0 Prep)

| Field | Value |
|-------|--------|
| **Status** | **Proposed** (awaiting owner Accept of full epic) — **Slice 1–7 implemented** (2026-08-10): schema → ingest → claim → media → partner UX → mapping/validate → **admin UI** |
| **Stage / epic** | **M2.0** Concierge Supply · Stages **210.1–210.7** |
| **Date** | 2026-08-10 |
| **Deciders** | Product owner, Engineering (Senior Architect) |
| **Brand** | Airento (`getSiteDisplayName()`) — not legacy GoStayLo display |
| **Related** | Soft launch supply (`docs/runbooks/SOFT_LAUNCH_PLAN.md`); listing drafts (`metadata.is_draft`); import foundation (`database/migrations/009_listings_external_import_foundation.sql`); iCal (`listings.sync_settings`); seasonal SSOT (`seasonal_prices` + ADR-181); Lazy Realtor precedent (`metadata.source = TELEGRAM_LAZY_REALTOR`) |
| **SSOT after Accept** | This ADR + pointer in `ARCHITECTURAL_DECISIONS.md` → then Manifesto / Constitution / System Map on first implementing PR |

---

## 1. Context

### 1.1 Product problem

Marketplace cold start: partners will not self-serve the listing wizard on an empty platform. They already keep inventory on Airbnb/Booking and in **heterogeneous** Excel / Google Sheets / PDF rate cards (seasonal month+day grids, Drive photo folders, optional calendar links). Scraping Airbnb is rejected (ToS, blocking, fragility). UI «Airbnb import» was removed (Stage 200.34).

**Product decision (consensus):** white-glove **Concierge Supply** — ops (and later an Admin ingest API) create **draft listings** for the partner; partner **reviews / corrects / claims**; then moderation → `ACTIVE` + iCal.

### 1.2 As-is (code-truth audit, 2026-08-10)

| Area | Current state | Gap for Concierge |
|------|---------------|-------------------|
| Listing statuses | Enum `PENDING\|ACTIVE\|BOOKED\|INACTIVE\|REJECTED` | No `DRAFT` / `imported_draft` / `ready_for_review` in Postgres |
| Drafts | `INACTIVE` + `metadata.is_draft` | Reusable; cleanup cron may delete contentful drafts after **30d** |
| Import columns | `import_platform`, `import_external_id`, `import_external_url`, `last_imported_at`, `sync_settings` | Wired for external import; product commit path incomplete; mapper defaults **`PENDING`** (too early) |
| Units | **No** `units` table — one listing row + `max_capacity` | Do **not** invent multi-unit schema for M2.0 |
| Seasonal pricing | `seasonal_prices` **date ranges** + `price_daily` (booking SSOT); `price_monthly` stored but **not** used by PricingService | Partner month grids must expand to ranges; long-stay monthly checkout = **out of scope** without new ADR |
| Search price | Without dates ≈ `base_price_thb` | Seasonal peaks not in undated catalog SQL — acceptable for soft launch |
| Photos | `listings.images` JSONB + `cover_image`; Supabase bucket `listing-images` | External HTTPS rehost exists; **no** Drive crawler / R2 |
| Profiles / ownership | `listings.owner_id` TEXT → `profiles.id` | **No** shadow flag, **no** claim invite, **no** admin create-user API |
| Impersonation | Client localStorage only | **Not** a server session — unsuitable as Concierge ops auth |
| iCal | `sync_settings.sources[]` + `auto_sync`; cron includes **`INACTIVE`** | Drafts can hold feeds today; need ingest handshake + soft-delete hygiene |
| Claim / magic link | Password-reset / email-verify JWTs only | **No** partner listing claim token |

### 1.3 Example inbound artifact

Partner PDF/Sheet rate card («Show Property» style): unit code, BR/SQM, RU+EN offers, Maps URL, Drive folder, seasonal **month ฿ + day ฿** columns, sparse calendar column. High content value; poor machine SSOT as PDF — prefer Sheet; PDF = secondary extract path.

---

## 2. Decision

### 2.1 Operating model

1. **Concierge-first supply** for Wave 1–N until organic wizard adoption is real.  
2. Partner catalogs stay **heterogeneous**; Airento holds **one Listing SSOT** (wizard / partner listing write path).  
3. Inbound formats are handled by a **mapping layer** (ops + optional AI extract → normalized JSON → Admin ingest). Saved **mapping profiles** per partner (`show_property_v1`, …) — not one forced Excel schema for the market.  
4. Preferred ask to partners: copy into **our** Sheet template; never a hard requirement.

### 2.2 Listing lifecycle — **do not extend `listing_status` enum**

| Concept | Canonical representation |
|---------|---------------------------|
| Imported draft | `status = INACTIVE` + `metadata.is_draft = true` |
| Concierge origin | `import_platform` ∈ `concierge` / `concierge_pdf` / `concierge_sheet` (+ `import_external_id` = unit code) |
| Pipeline stage | `metadata.concierge_stage`: `imported_draft` → `ops_ready` → `partner_review` → `submitted` |
| GC protection | `metadata.concierge_protected = true` (cleanup-drafts **must skip**) |
| Ready for partner eyes | `concierge_stage = partner_review` (+ optional `needs_review`) |
| Submit to moderation | Clear draft flags as today → `PENDING` |
| Live | Admin approve → `ACTIVE` |

**Rejected:** new enum values `imported_draft` / `ready_for_review` (touches iCal/embed/moderation whitelists; dual FSM risk).

**SSOT for origin:** columns `import_*` — do not invent a parallel unused `metadata.import_source` as second truth.

### 2.3 Ownership & shadow accounts

1. Every listing has a real `owner_id` **before** public money path.  
2. **Shadow partner** = normal `profiles` row with `is_shadow = true` until claim (proposed column).  
3. Ops creates shadow profile → ingest listings onto that `owner_id` → email **magic claim link**.  
4. Claim = set credentials / confirm identity → `is_shadow = false`, `shadow_claimed_at` set; **ownership usually already correct** (no mass re-`owner_id` unless merge-into-existing-account path — see §2.4).  
5. Do **not** rely on current admin «login as» UI for server-side partner APIs.

### 2.4 Magic claim

Proposed tables (additive, TEXT ids, GRANT → RLS → POLICY per Supabase constitution):

- `concierge_import_batches` — audit scope, source type, mapping profile, created_by admin.  
- `partner_claim_invites` — `token_hash` (never store raw token), `email`, `expires_at`, `claimed_at`, FK to batch/partner.  
- Optional `listings.concierge_batch_id`.

**Token flow:** Admin creates invite → email link `/claim/…` → `POST` claim with password (reuse password policy SSOT) → issue `gostaylo_session` → clear shadow.

**Merge path (optional, explicit):** if partner already has a profile, claim may reassign batch listings `owner_id` in one transaction — requires Accept + audit log; default Wave 1 = greenfield shadow email = partner real email.

### 2.5 Pricing from rate cards

1. Expand season headers (e.g. Nov, 15 Dec–15 Jan) → `seasonal_prices` rows with **`price_daily`**.  
2. Choose a default night rate (e.g. shoulder/low) → `listings.base_price_thb` (and ADR-181 asset path if non-THB).  
3. `price_monthly` may be stored for partner notes / future long-stay — **must not** drive BookingService / checkout without a **new** ADR.  
4. **Forbidden:** writing fee splits, `pricing_profiles`, FX hardcodes, or ledger from Concierge ingest.

### 2.6 Photos & media

1. Persist HTTPS image URLs in `listings.images` / `cover_image`.  
2. Rehost via existing migrate-external-images → Supabase `listing-images` (not Cloudflare R2 for M2.0).  
3. Google Drive **folder** links: store in metadata for ops; auto-crawl is a **later slice** after URL materialization playbook.  
4. Partner-provided originals preferred; no Airbnb scrape.

### 2.7 iCal handshake

1. Ingest may set `sync_settings.sources[]` + `auto_sync: true` on **draft** (`INACTIVE`).  
2. Cron already syncs `INACTIVE` — keep that.  
3. Soft-launch policy: prefer calendar configured (or exclusive manual calendar ack) before trusting Instant Book / heavy traffic.  
4. Soft-deleted listings (`metadata.is_deleted`) excluded from iCal cron + soft DELETE pauses `auto_sync` (**Stage 200.127**).

### 2.8 Inbound API (design only until implementation)

Admin-only:

- `POST /api/v2/admin/concierge/partners` — provision shadow profile.  
- `POST /api/v2/admin/concierge/ingest` — normalized JSON → batch + listings + seasons + images + optional iCal (idempotent on `(owner_id, import_platform, import_external_id)`).  
- `POST /api/v2/admin/concierge/claim-invites` — create + email invite.  
- `POST /api/v2/admin/concierge/rehost-media` — HTTPS rehost → `listing-images`.  
- `POST|GET /api/v2/admin/concierge/validate-payload` — mapping dry-run (no DB).  
- `GET /api/v2/admin/concierge/batches` · `batches/[id]` · `partner-search` · `prompt` — admin UI helpers.  
- UI **`/admin/concierge`** — import workshop + batch journal (ADMIN).  
- `POST /api/v2/auth/claim-partner` — public claim completion.

AI extraction runs **ops-side** (offline / Cursor / internal tool) producing normalized JSON — **not** a guest-facing agent writing money fields unsupervised. Human QC before `PENDING`/`ACTIVE`. Prompt template: [`runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md`](../runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md). Mapping profiles: `lib/services/concierge/mapping-profiles/`.

### 2.9 Explicit non-goals (M2.0)

- Airbnb/Booking content scrape or resurrecting partner Airbnb-import UI as primary path.  
- Channel manager / Guesty-class sync.  
- `units` table / hotel multi-unit inventory model.  
- Monthly long-stay as booking SSOT.  
- Partner self-serve «upload any Excel» storefront.  
- Replacing Supabase Storage with R2 in this epic.

---

## 3. Consequences

### Positive

- Unblocks live catalog without forcing partners through wizard.  
- Reuses draft, import columns, seasonal ranges, iCal, image rehost.  
- Keeps Listing + pricing SSOT intact; mapping absorbs format chaos.

### Risks / mitigations

| Risk | Mitigation |
|------|------------|
| Draft GC deletes Concierge stock | `concierge_protected` + cleanup skip |
| Mapper writes `PENDING` early | Concierge ingest forces `INACTIVE`+`is_draft` |
| Bad AI prices / photos | Mandatory ops/partner review stages |
| Shadow email ≠ payout identity | Prefer real partner email; KYC/payout still gated |
| Dual ownership after merge claim | Single txn + audit; default Wave 1 avoid merge |
| Drive links hotlink / expire | Rehost to `listing-images` before marketing push |

### Docs to update on first implementing PR

- `docs/TECHNICAL_MANIFESTO.md` (short delta)  
- `docs/CONSTITUTION.md` — listing **effective** lifecycle (not only booking FSM)  
- `docs/SYSTEM_MAP.md` — new tables + admin Concierge routes  
- `docs/HISTORY.md` — Stage entry when shipped  

---

## 4. Implementation slices (after Accept)

| Slice | Scope |
|-------|--------|
| **0** | Owner Accept this ADR; optional Wave 1 manual Concierge playbook (no code) |
| **1** | ✅ Migration: `is_shadow`, batches, claim invites, RLS; cleanup-drafts guard (`057_concierge_supply_slice1.sql`, Stage 210.1) |
| **2** | ✅ Admin provision + ingest API (`/api/v2/admin/concierge/partners`, `/ingest`, Stage 210.2) |
| **3** | ✅ Claim link + email + `/claim` + RU OTP (`claim-invites`, `claim-partner`, Stage 210.3) |
| **4** | ✅ Post-ingest image rehost + Drive→HTTPS ops playbook (`rehost-media`, Stage 210.4; [`runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md`](../runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md)) |
| **5** | ✅ Partner «review Concierge drafts» UX + submit (welcome banner, badge, review CTA, Stage 210.5) |
| **6** | ✅ Mapping profiles + validate-payload + AI extract prompt (`show_property_v1` / `generic_concierge_v1`, Stage 210.6; [`runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md`](../runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md)) |
| **7** | ✅ Admin Concierge UI `/admin/concierge` (import + batch journal, Stage 210.7) |
| **7.1** | ✅ UX polish: fence strip, mapping select, Drive hint, checklist, existing-partner notify (Stage 210.71) |

---

## 5. Invariants

1. **One Listing SSOT** — Concierge writes the same shape as the partner wizard / partner listing APIs.  
2. **No new `listing_status` enum values** for this epic without a superseding ADR.  
3. **Booking money** uses `base_price_thb` + `seasonal_prices.price_daily` only; monthly rates are non-authoritative for checkout.  
4. **No fee/FX/ledger mutations** in Concierge ingest.  
5. **TEXT** profile/listing ids; new `public` tables: GRANT → RLS → POLICY.  
6. **Raw claim tokens never stored** — hash only.  
7. Display brand remains **`getSiteDisplayName()`** / `{brand}` in user-facing copy.

---

## 6. Accept / reject

| Decision | Owner |
|----------|--------|
| Accept ADR-210 as policy | ☐ Product owner |
| Prefer real email on shadow vs synthetic | ☐ Product owner |
| Allow claim-time `owner_id` merge into existing accounts in Wave 1 | ☐ Yes / ☐ No (default **No**) |
| First code slice after Accept | ☐ Slice 1 schema |

**Until Accept:** treat this document as design consensus; do not ship Concierge feature code that invents a second listing FSM or monthly booking SSOT.
