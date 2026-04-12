# GoStayLo Anti-Disintermediation Policy (Chat)

## Purpose

GoStayLo is an aggregator. Chat must not become a channel for partner/renter migration to external messengers, direct phone calls, or direct invoicing outside platform escrow.

This document defines a practical, low-risk implementation strategy (Airbnb-style) that protects commission without breaking chat UX.

## Scope

- Applies to renter/partner conversations in:
  - `POST /api/v2/chat/messages`
  - system-generated text that can include user-entered fragments
- Does **not** block admin/moderator operational communications.

## Threat Model

Primary bypass vectors:

- direct phone numbers (`+66...`, local formats with spaces/dashes)
- email addresses (`name@domain.tld`)
- messenger handles/links (`wa.me`, `t.me`, `telegram.me`, `whatsapp`, `line.me`, `wechat`, etc.)
- obfuscation:
  - spaced digits (`8 9 1 4 5...`)
  - "at"/"dot" textual forms
  - mixed Cyrillic/Latin substitutions
  - split across multiple messages

## Product Policy

- Contact exchange is disallowed before on-platform booking/payment milestones.
- User-facing copy should be neutral and clear:
  - "For your safety and booking protection, please keep communication in GoStayLo chat."
- Repeated attempts increase risk score and can trigger moderation actions.

## Enforcement Architecture (Server-First)

### 1) Message Guard in API

Single source of truth: `POST /api/v2/chat/messages`.

Pipeline:

1. normalize text (unicode, separators, repeated symbols)
2. detect sensitive patterns (phone/email/handles/links)
3. classify confidence (`low`/`medium`/`high`)
4. apply action by policy mode:
   - `warn_only` (phase 1)
   - `redact` (phase 2)
   - `block` (phase 3, high confidence)

### 2) Structured Telemetry

Write violation events with minimal payload to `critical_signal_events`:

- `signal_key`: `CONTACT_LEAK_ATTEMPT`
- detail:
  - `conversationId`
  - `senderId`
  - `severity`
  - `detectorKinds` (phone/email/link/handle)
  - `hash` of normalized suspicious fragment (not full raw contact)

Optional Telegram alert only for repeated/high-risk attempts.

### 3) Progressive Rollout Flags

Use env/settings feature flags:

- `CHAT_CONTACT_GUARD_MODE=warn_only|redact|block` (документ-идея)
- **`CONTACT_SAFETY_MODE=ADVISORY|REDACT|BLOCK`** — канон в коде (**`lib/contact-safety-mode.js`**): **ADVISORY** ≈ warn_only, **REDACT** ≈ redact, **BLOCK** ≈ block.
- `CHAT_CONTACT_GUARD_MIN_SEVERITY=medium|high`

Default rollout:

1. `warn_only` for calibration
2. `redact` for obvious contacts
3. `block` for repeated/high-confidence leakage

### 4) UI Behavior

- Client may pre-warn, but server decision is authoritative.
- On blocked message API returns domain code **`CONTACT_SAFETY_BLOCKED`** (см. **`POST /api/v2/chat/messages`** при **`CONTACT_SAFETY_MODE=BLOCK`**).
- UI shows localized toast and keeps user in chat (no hard crash).

## "How Airbnb-like platforms do it"

Common pattern:

- multi-layer detection (regex + normalization + behavior signals)
- milestone-based restrictions (stricter before confirmed booking)
- selective redaction over blanket hard-block in early rollout
- repeat-attempt risk escalation to trust & safety tooling
- transparent UX messaging ("stay on-platform for protection")

GoStayLo should follow the same phased model to avoid false positives while quickly reducing commission leakage.

## Implementation Plan (Safe Order)

1. Add detector module (`lib/chat/contact-guard.js`) with unit tests.
2. Integrate in `POST /api/v2/chat/messages` in `warn_only`.
3. Add telemetry dashboard query (`CONTACT_LEAK_ATTEMPT` per day/user).
4. Turn on `redact` for high-confidence patterns.
5. Enable selective `block` for repeat offenders.
6. Update moderation UI/API for escalation workflows.

## Non-Goals

- No client-only blocking as primary protection.
- No irreversible bans on first low-confidence match.
- No storage of raw PII in alert payloads.

## References

- `ARCHITECTURAL_DECISIONS.md` (SSOT policy)
- `docs/TECHNICAL_MANIFESTO.md` (runtime behavior)
- `docs/ARCHITECTURAL_PASSPORT.md` (system map)
