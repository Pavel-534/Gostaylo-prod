# PWA iOS — real-device smoke (iPhone 11 Pro+)

**Stage 189.0+** — checklist for Phuket / SEA guest install.  
**Fill measured results:** [`docs/STAGE_189_IOS_SMOKE_RESULTS.md`](STAGE_189_IOS_SMOKE_RESULTS.md) (not the legacy 172 filename).

After cold open in **standalone**, optional: Safari Web Inspector → Console → copy `[Airento PWA 189]` snapshot into the results doc (`stage` should be **`189.1`**). After ~30s background → resume, also copy the resume log / `airento_pwa_resume_v1`.

## Preflight

1. Staging HTTPS with valid TLS (no self-signed).
2. Fresh Safari (clear Website Data for the origin) **or** delete Home Screen icon and re-add.
3. Wi‑Fi + one pass on cellular (4G).

## Cold start

1. Add to Home Screen → open icon (standalone).
2. Confirm first paint shell (no white flash >2s on home/catalog).
3. Safari Web Inspector → Application → Service Workers: **activated + controlling**.
4. Soft kill app → reopen: still controlled; no infinite reload loop.

## Standalone behaviour

1. Navigate Home → Catalog → PDP → pick dates → checkout stub (no live charge).
2. Background 30s → resume: **no API refetch storm** (171.32 `refetchOnWindowFocus: false` in standalone).
3. Safe areas: bottom nav / chat composer clear of home indicator (`viewport-fit=cover`).

## Messaging / booking

1. Partner: open `/messages/[id]` PENDING → Confirm visible (action bar and/or milestone).
2. Renter: open checkout → legal consent → mock pay if enabled.

## After deploy

1. New SW installs without stuck old chunks (register `updateViaCache: 'none'`).
2. Critical update toast only when release gate says so (Stage 175).

## Pass criteria (Phuket)

| Check | Pass |
|-------|------|
| Cold standalone LCP feel | Catalog usable &lt; ~4s on 4G |
| SW controlling | Yes on first launch after install |
| Focus resume | No visible jank / duplicate loaders |
| Chat confirm | Partner can confirm on phone |
