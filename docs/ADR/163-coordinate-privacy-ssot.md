# ADR-163: Public Listing Coordinates — Deterministic Privacy SSOT (Wave C)

| Field | Value |
|-------|--------|
| **Status** | Accepted (Stage 163.2) |
| **Stage** | 163.2 — Coordinate privacy on map & public read-paths |
| **Date** | 2026-06-17 |
| **Deciders** | Product, Engineering |
| **Supersedes (partially)** | UI-only privacy in `ListingMap.jsx` (500 m circle at true center), client `markerVisualFlags` |
| **SSOT after adoption** | This ADR + **`lib/geo/listing-public-coordinates.js`** + `ARCHITECTURAL_DECISIONS.md` §10 (pointer) |

**Related audit:** Wave C code inspection (163.2 prep) — no existing jitter; `mapLocationDisplayMode` is presentation-only.

**Related code today:** `lib/listing-location-privacy.js`, `lib/config/category-behavior.js`, `lib/config/category-wizard-profile-db.js`, `lib/api/search/map-pins-query.js`, `lib/api/run-listings-search-get.js`, `app/api/v2/listings/[id]/route.js`, `lib/seo/listing-schema-org.js`, `components/listing/InteractiveSearchMap.jsx`.

---

## 1. Context and problem

Guests must not infer the exact address of a private rental from public APIs or map pins. Today:

- **Category registry** already defines `mapLocationDisplayMode: 'privacy' | 'exact'` per vertical.
- **UI** shows a 500 m circle or `~` on price pills — but **API always returns true `latitude`/`longitude`** (including `GET /api/v2/search/map-pins` after 163.1).
- Marketing copy claims *"exact address after booking"* — **not enforced** server-side.

PostGIS (`listings.coordinates`, GiST, radius/KNN) must continue to use **true** coordinates internally. Obfuscation applies only on **public serialization**.

---

## 2. Decision

### 2.1 Single module

All public coordinate output flows through **`lib/geo/listing-public-coordinates.js`**:

| Export | Role |
|--------|------|
| `resolveCoordinatePrivacyPolicy` | `fuzz` vs `exact` from category SSOT |
| `resolveCoordinateRevealLevel` | `exact` after booking / owner / staff |
| `obfuscateCoordinates` | Deterministic offset (no `Math.random`) |
| `serializePublicCoordinates` | One DTO for every read-path |
| `COORD_PRIVACY_*` env-backed constants | Radius band + salt |

**`lib/listing-location-privacy.js`** remains a thin facade for UI mode (`getListingLocationDisplayMode`) — it delegates policy to geo SSOT, no duplicate rules.

### 2.2 Algorithm (deterministic annulus jitter)

For `policy.mode === 'fuzz'` and `revealLevel === 'public_fuzz'`:

1. Seed: `SHA-256("{listingId}:{COORD_PRIVACY_SALT}")`
2. `bearingDeg = uint32(hash[0..3]) / 2³² × 360`
3. `distanceM = radiusMinM + (uint32(hash[4..7]) / 2³²) × (radiusMaxM - radiusMinM)`
4. Geodesic offset from true `(lat, lng)` → public `(lat, lng)`

**Defaults:** `radiusMinM = 150`, `radiusMaxM = 300` (env overrides).

**Invariants:**

- Same `listingId` + salt → same public point on every endpoint and reload.
- `exact` verticals (transport, yacht, tour) → **no offset** (true coords).
- **Never** persist obfuscated coords in `listings` — compute on read only.

### 2.3 Reveal after booking

`resolveCoordinateRevealLevel → 'exact'` when viewer is:

- Listing **owner**, or
- **Staff** (`isStaffRole`), or
- **Renter** with booking on this listing in `CONFIRMED | PAID | PAID_ESCROW | THAWED | COMPLETED` (configurable set in module).

Then API returns true `latitude`/`longitude` and may include `address` (today always exposed — tighten in 163.2).

### 2.4 Wire-up points (implementation checklist)

| Read-path | Change |
|-----------|--------|
| `mapPinRowToPayload` | `serializePublicCoordinates` |
| `run-listings-search-get` listing transform | same |
| `GET /api/v2/listings/[id]` | same + strip `address` when fuzz |
| `lib/seo/listing-schema-org.js` `geoBlock` | fuzz or omit `geo` for privacy |
| `lib/catalog/map-listing-detail-api.js` | passthrough if API already serialized |
| Client maps | Trust `isApproximate` from server; remove duplicate `markerVisualFlags` logic over time |

**PostGIS queries:** unchanged (true coords). Optional: expand client bbox by `radiusMaxM` when pre-filtering fuzzed pins (Phase 2).

### 2.5 Vertical policy (no new parallel rules)

| `wizard_profile` | `mapLocationDisplayMode` | Public coords |
|------------------|--------------------------|---------------|
| `stay` | privacy | **fuzz** |
| `nanny`, `chef`, `massage`, `service_generic` | privacy | **fuzz** |
| `transport`, `transport_helicopter` | exact | **exact** (pickup) |
| `yacht` | exact | **exact** (berth) |
| `tour` | exact | **exact** (meeting point) |

Source: `resolveCategoryBehavior(slug, wizard_profile)` — **do not** add `category !== 'transport'` checks in routes.

**Per-listing override (deferred):** `listings.metadata.coordinate_privacy_override: 'fuzz'|'exact'|null` — not in 163.2 unless product requests.

---

## 3. Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `COORD_PRIVACY_SALT` | platform constant fallback | Cross-instance deterministic seed |
| `COORD_PRIVACY_RADIUS_MIN_M` | `150` | Annulus inner radius |
| `COORD_PRIVACY_RADIUS_MAX_M` | `300` | Annulus outer radius |

---

## 4. Public DTO shape

```json
{
  "latitude": 7.91234,
  "longitude": 98.40123,
  "isApproximate": true,
  "locationPrivacyMode": "fuzz"
}
```

When `isApproximate: true`, clients show `~` pill / privacy circle; **must not** re-derive offset locally.

---

## 5. Test case matrix

| # | `wizard_profile` | `revealLevel` | True coords | Expected `isApproximate` | Expected position |
|---|------------------|---------------|-------------|--------------------------|-------------------|
| T1 | `stay` | `public_fuzz` | 7.88, 98.39 | `true` | offset ∈ [150, 300] m, stable per id |
| T2 | `stay` | `exact` (renter booked) | 7.88, 98.39 | `false` | true coords |
| T3 | `transport` | `public_fuzz` | 7.88, 98.39 | `false` | true coords (exact vertical) |
| T4 | `yacht` | `public_fuzz` | 7.88, 98.39 | `false` | true coords |
| T5 | `tour` | `public_fuzz` | 7.88, 98.39 | `false` | true coords |
| T6 | `chef` | `public_fuzz` | 7.88, 98.39 | `true` | fuzzed |
| T7 | `stay` | `public_fuzz` | null coords | — | `{ latitude: null, longitude: null }` |
| T8 | `stay` | `public_fuzz` | 7.88, 98.39 | `true` | same output from map-pins + search + PDP serializer |
| T9 | owner | `exact` | 7.88, 98.39 | `false` | true coords + address allowed |
| T10 | staff | `exact` | 7.88, 98.39 | `false` | true coords |
| T11 | two listing ids | `public_fuzz` | same true point | `true` | **different** public points (seed includes id) |
| T12 | same listing id | `public_fuzz` | 7.88, 98.39 | `true` | **identical** across two calls (determinism) |

**Distance assertion helper:** Haversine distance from public point to true point ∈ `[radiusMinM, radiusMaxM]` (±1 m tolerance).

**Regression:** `npm run smoke:full-financial` unchanged (no coord assertions in smoke).

---

## 6. Non-goals (163.2)

- Storing `public_lat`/`public_lng` columns in DB.
- Obfuscating PostGIS `coordinates` or GiST indexes.
- Partner wizard / MapPicker behavior (partners always see true pin).
- i18n copy changes (already mention approximate location).

---

## 7. Rollout

1. Ship **`listing-public-coordinates.js`** + unit tests (T1–T12) — e.g. Jest/Vitest or `node --experimental-vm-modules` once test harness is aligned with `@/` imports.
2. Wire map-pins + search (highest leak surface).
3. Wire listing detail + schema.org.
4. Client: trust server flags; deprecate client-only offset logic.
5. Update `docs/TECHNICAL_MANIFESTO.md` + `docs/ARCHITECTURAL_PASSPORT.md` (v12.163.2).

---

## 8. Open questions

1. **Schema.org:** fuzz `geo` vs omit entirely for privacy listings?
2. **BBox inflation:** needed for map search accuracy when pins are offset — optional; cluster centroids use grid cell center (Stage 163.3 ✅).
3. **CONFIRMED-only vs PAID_ESCROW** for reveal — align with chat / check-in instructions copy.
