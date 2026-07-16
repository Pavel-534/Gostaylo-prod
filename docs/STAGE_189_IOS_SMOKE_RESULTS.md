# Stage 189.1 — iOS Real Device Smoke Results (iPhone 11 Pro)

**Status: WAITING ON OWNER** — no measured rows yet (all TBD).  
**Checklist:** [`docs/PWA_IOS_REAL_DEVICE_SMOKE.md`](PWA_IOS_REAL_DEVICE_SMOKE.md)  
**After fill:** agent runs Stage **189.2** analysis + code fixes (not invent timings).

| Field | Value |
|-------|--------|
| Date | _TBD by owner_ |
| Device | iPhone 11 Pro (A13) |
| iOS | _TBD_ |
| Origin | Staging HTTPS / prod |
| Build / commit | `main` (Stage 189.1 PWA) |
| Network | Wi‑Fi + 4G Phuket |

## Results matrix (owner)

| Check | Result (pass/fail + timing) | Notes |
|-------|----------------------------|-------|
| Cold start standalone | ⏳ | Target: catalog usable &lt; ~4s on 4G |
| SW activated + controlling | ⏳ | Web Inspector → Service Workers |
| Soft kill → reopen | ⏳ | No reload loop |
| Home → Catalog → PDP → dates → checkout stub | ⏳ | No live charge |
| Background 30s → resume | ⏳ | No refetch storm; expect `[Airento PWA 189]` resume log |
| Safe areas | ⏳ | Home indicator vs nav/composer |
| Partner chat Confirm | ⏳ | PENDING thread |
| Push (optional) | ⏳ | iOS PWA push often limited |
| After deploy SW update | ⏳ | `updateViaCache: none` |

### Optional: paste console snapshot

After cold open in standalone, Safari Web Inspector → Console → copy `[Airento PWA 189]` object (`stage: "189.1"`, includes `paint.fcpMs` + `swStatus`).

Also after 30s background → resume: copy the resume event line.

```
(paste cold-start here)
```

```
(paste resume here)
```

### Optional: localStorage

```js
JSON.parse(localStorage.getItem('airento_pwa_perf_v1'))
JSON.parse(localStorage.getItem('airento_pwa_resume_v1'))
```

## Agent code baseline (pre-device)

| Item | Status |
|------|--------|
| Telemetry cold + resume + FCP + SW status | ✅ 189.1 |
| iOS image constrained heuristic (no NIA) | ✅ 189.0 |
| Calendar horizon 90d when constrained | ✅ 189.1 |
| SW skipWaiting before precache | ✅ 189.1 |
| Standalone SW update throttle (30m) | ✅ 189.1 |
| Standalone refetch focus/reconnect off | ✅ 171.32 / 189.0 |
| Composer `pb-safe-chat-composer` + standalone CSS | ✅ 189.1 |
| Playwright mobile-chat | ✅ 172 verification |

## Sign-off

- Owner: ________________  
- Phuket guest install pass: ☐ Yes ☐ No — blockers: ________
