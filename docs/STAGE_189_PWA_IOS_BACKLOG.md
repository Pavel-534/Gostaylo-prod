# Stage 189 — PWA iOS backlog

**Gate:** [`STAGE_189_IOS_SMOKE_RESULTS.md`](STAGE_189_IOS_SMOKE_RESULTS.md) must leave ⏳ state before locking **189.2** priorities.

## Already shipped (code)

| ID | Item | Stage |
|----|------|-------|
| RSC Home/Catalog/PDP | Server bootstrap + hydrate | 171.24–171.27 |
| SW precache trim | ≤ guest shell budget | 171.28 |
| Standalone refetch off | focus + reconnect | 171.32 / 189.0 |
| SW cold skipWaiting + updateViaCache none | 171.42 |
| viewport-fit cover | 171.42 |
| iOS image constrained without NIA | 189.0 |
| Cold-start telemetry | 189.0 |
| SW early skipWaiting + GET_STATUS | **189.1** |
| Calendar 90d constrained / iOS | **189.1** |
| Resume telemetry + FCP marks | **189.1** |
| Standalone SW update throttle | **189.1** |
| Chat composer safe-area SSOT class | **189.1** |
| Chat visualViewport scroll sync | **189.1** |

## Candidate 189.2 (rank after smoke fill)

| Priority | Candidate | Trigger from smoke |
|----------|-----------|-------------------|
| P0 | Further FLJS / provider defer | Cold start &gt; 4s |
| P0 | SW activate race / reload loop | Soft-kill fail |
| P1 | Safe-area residual (nav vs composer) | Safe area fail |
| P1 | Resume storm residual (query / poll) | Resume storm still visible |
| P2 | Push education / Cap path | Push fail on PWA |

## Provisional stability (pre-device)

**9.0 / 10** code baseline after 189.1; **device score TBD** until owner matrix filled.
