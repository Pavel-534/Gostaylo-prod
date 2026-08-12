# Partner Wizard Design Handoff (SSOT)

> **Status:** agreed corridor through **Stage 200.108** (2026-08-12)  
> **Product brand:** **`getSiteDisplayName()`** / i18n `{brand}` only in UI (prod env: Airento)  
> **Audience:** engineers / agents polishing partner listing UX without redesigning the product

Use this file instead of re-deriving rules from chat. Code is SSOT; this is the **policy brief**.

---

## 1. Goal and corridor

Ship a **shared visual rhythm** for the partner listing wizard (`/partner/listings/new` + `/partner/listings/[id]`), then scale the same language to other partner surfaces in **small Stages** — never “apply the whole design system to the entire app” in one PR.

**Principle:** hierarchy and separation first (titles → labels → helpers → mint dividers → mobile flat canvas). Do not invent parallel status matrices, card skins, or hex borders.

---

## 2. Live SSOT paths

| Concern | Path |
|--------|------|
| Section title / field label / mint divider tokens | `lib/ui/partner-section-rhythm.js` |
| Divider component | `components/partner/PartnerSectionDivider.jsx` |
| Mobile flat canvas | `lib/ui/mobile-flat-canvas.js` (wizard re-exports in `wizard-step-layout.js`) |
| Wizard chrome / scroll / sticky CTA pad | `…/chrome/listing-wizard-layout.js` |
| Sticky mobile action bar | `…/chrome/ListingWizardMobileActionBar.jsx` |
| Step root / page title tokens | `…/components/wizard-step-layout.js` |
| Shared wizard shell (create + edit + Concierge drafts) | `ListingWizardPageInner.jsx` |

**Hierarchy**

1. Page step title — `WIZARD_STEP_TITLE_CLASS` (`text-xl` / `sm:text-2xl`)
2. Semantic group — `PARTNER_SECTION_TITLE_CLASS` (`text-base font-semibold`)
3. Field — `PARTNER_FIELD_LABEL_CLASS` (`text-sm font-medium`)
4. Helper — short one-liner, usually `text-xs text-slate-500`, **under** the control

**Mint dividers (Stage 200.97 — do not weaken)**

- Recipe: `h-0.5`, `bg-brand-mint/40`, `dark:bg-brand-mint/55`, inset `mx-4` / `sm:mx-6`, wrap `py-3 sm:py-4`
- Only **between semantic groups**, never between every field
- Always use `<PartnerSectionDivider />` — do not re-hardcode opacity/`h-px`

---

## 3. Wizard IA (6 steps)

| # | Step | Component | Rhythm status (after 200.101) |
|---|------|-----------|-------------------------------|
| 1 | Basics | `StepGeneralInfo.jsx` | SSOT (200.95+) |
| 2 | Location | `StepLocation.jsx` | SSOT (200.94+) |
| 3 | Photos | `StepPhotos.jsx` | SSOT (200.101) |
| 4 | Pricing | `StepPricing.jsx` | SSOT (200.95+) |
| 5 | Calendar | `StepCalendarSection.jsx` | SSOT (200.107) — section titles for sync/blocks/seasons |
| 6 | Preview | `StepPreview.jsx` | SSOT (200.101); live L1 price from **200.96** |

Do **not** confuse **service type** (radio) with **category** (`PartnerCategoryPickerTwoStep`).

Steps live under `app/(partner)/partner/listings/new/components/Step*.jsx` — there is **no** `components/steps/` folder.

---

## 4. Concierge (ADR-210)

Concierge drafts open the **same** wizard routes and shell (`ListingWizardProvider` + `ListingWizardPageInner` + same layout tokens). Extra UX is content-only (`ConciergeWizardReviewBanner`, list checklist/badge). **No second layout.**

---

## 5. Closed decisions (do not reopen casually)

| Topic | Decision |
|-------|----------|
| Mint strength | Keep 200.97 `/40`–`/55` + `h-0.5` — rejected weaker `/30` + `h-px` sweeps |
| Sticky CTA pad | `pt-3` + additive safe-area on bar; no `py-*` + `.safe-area-pb` override (200.98) |
| Early / late stay | Soft “on request” / chat only (200.99) — **no** paid early/late or night blocking without a large calendar/ledger Stage |
| Preview price | Live form L1 + `pricingPreview` / synced `metadata.base_price_asset` (200.96) |
| View on site | In-app navigation — **no** `target="_blank"` |
| Hex / arbitrary colors | Forbidden in product UI — tokens / Tailwind semantic only |
| Primary CTA | `<Button variant="brand">` only |
| Guest wording in renter UI | SSOT `lib/i18n/get-guest-provider-label.js` — not «партнёр» for guests |

---

## 6. Stage map (design rhythm wave)

| Stage | Outcome |
|-------|---------|
| 200.90–92 | Street clear; 6-step IA; Calendar = step 5 |
| 200.93 | Calendar auto-draft soft load |
| 200.94 | Rhythm pilot Location/Calendar + listing cards |
| 200.95 | Scroll clearance; Basics/Pricing dividers; RU genitive |
| 200.96 | Live preview price; in-app view-on-site; PDP same-currency hero |
| 200.97 | Tighter void; stronger mint divider |
| 200.98 | Sticky CTA vertical balance |
| 200.99 | Stay arrival hours + soft flexibility |
| 200.100 | RU plurals; cancellation as section title; trust/helpers compact |
| **200.101** | **Photos + Preview on section rhythm SSOT** |
| **200.102** | **Dark Mode Input/`--input` tokens + brand-mint focus (Input/Textarea/Select)** |
| **200.103** | **`/partner/bookings` hub list surface + section rhythm** |
| **200.104** | **`/partner/dashboard` section rhythm + hub mint metrics** |
| **200.105** | **`/partner/finances` + `/partner/payout-profiles` section rhythm + hub mint** |
| **200.106** | **`/partner/settings` section rhythm + field labels + hub mint** |
| **200.107** | **Wizard Calendar step section titles (sync / blocks / seasons)** |
| **200.108** | **`/partner/reviews` + guest-review section rhythm + hub mint** |
| **200.109** | **Global `/partner/calendar` section rhythm + hub mint education** |
| **200.110** | **`/partner/promo` section rhythm + field labels + hub mint** |
| **200.111** | **`/partner/listings` Filters / Stats / List section rhythm + hub mint** |
| **200.112** | **Guest-review + promo/settings toast i18n sweep** |
| **200.113** | **`WorkspaceEmptyState` on listings / reviews / promo** |
| **200.114+** | Pick next focus (see §8) |

Docs: `docs/HISTORY.md`, tip in `docs/TECHNICAL_MANIFESTO.md`.

---

## 7. Implementation checklist (any new partner form block)

1. Import `PARTNER_SECTION_TITLE_CLASS` / `PARTNER_FIELD_LABEL_CLASS` and `<PartnerSectionDivider />`.
2. Wrap semantic groups in `<section data-partner-section="…">`.
3. Prefer `WIZARD_MOBILE_FLAT_*` / `MOBILE_FLAT_*` — no nested heavy cards on `&lt;sm`.
4. Touch targets ≥ **44×44** on mobile.
5. Helpers: short; under controls; no marketing fluff.
6. Do not change business logic (upload, pricing, calendar, escrow) in a “rhythm” Stage.
7. Same PR: `HISTORY.md` + short manifesto delta; tests that assert SSOT imports where useful.
8. Run `npm run check:guest-terminology` (and `check:brand` — ignore pre-existing archive ADR noise unless you touched those files).

---

## 8. Corridor status (after 200.113)

**Partner cabinet + wizard rhythm SSOT is complete** (through 200.111). Post-rhythm polish:

| Stage | Focus |
|-------|--------|
| **200.112** | Done — guest-review UI + promo flash / settings save toasts i18n |
| **200.113** | Done — `WorkspaceEmptyState` on listings / reviews / promo (+ listings filter-empty) |

| Deferred | Why not now | Safer later |
|----------|-------------|-------------|
| **`/messages`** | Shared guest + partner hall; already `MOBILE_FLAT_SHELL`. Forcing `PARTNER_*` mint would leak partner chrome onto renters. | Separate product Stage only if chat shell gets its own shared tokens (not partner mint). |
| **`/profile/referral`** | Ambassador storefront for all roles; partner nav is redirect only. Partner mint here would rebrand guest ambassador UX. | Profile/product shell polish without `PARTNER_HUB_*`. |
| **New onboarding checklist** | Already SSOT: `PartnerOnboardingChecklist` + `/api/v2/partner/onboarding-status`. | Optional hub polish only — no second FSM. |

**Not next:** full-product design sweep, paid early/late, weakening mint dividers, Concierge layout fork, global `border-slate-500`, forcing partner mint onto guest/admin, inventing `PartnerEmptyState`.

**Done recently:** 200.102–200.113.

---

## 9. Related reading

- `docs/guides/STAGE200_94_AUDIT_AND_SCALING_PLAN.md` — early audit / scaling notes (partially superseded by 200.95–200.101)
- `lib/ui/partner-section-rhythm.js` — token comments
- `AGENTS.md` / `.cursorrules` — brand + docs constitution
