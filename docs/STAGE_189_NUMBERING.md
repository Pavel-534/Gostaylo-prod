# Stage numbering — 189+ (canonical from 2026-07-16)

## Policy

| Era | Numbers | Notes |
|-----|---------|--------|
| Historical | ≤ 171.x, ADR-172 Deal Context, etc. | Keep as historical labels in manifesto |
| Verification lock (Jul 2026) | Documented as **172.0 verification** but **collided** with ADR-172 | Do not reuse 17x for new work |
| **Current** | **189.0, 189.1, 189.2…** | All new PWA / Capacitor / mobile stages |

## Why 189

Passport/manifest were already at **12.188.x**. Jumping to **Stage 189** aligns product stage IDs with passport major line and avoids colliding with ADR-172 (Deal Context SSOT) and the Jul-16 “172.0 verification” label.

## Active branches

| Branch | Stage |
|--------|--------|
| `feature/stage-189-pwa-ios` | 189.0 PWA iOS deep + smoke gate |
| `feature/capacitor-shell` | Cap scaffold → 189.2+ TestFlight |

## Owner smoke file

Fill: [`docs/STAGE_189_IOS_SMOKE_RESULTS.md`](STAGE_189_IOS_SMOKE_RESULTS.md)  
(Legacy alias: `STAGE_172_IOS_SMOKE_RESULTS.md` redirects here.)
