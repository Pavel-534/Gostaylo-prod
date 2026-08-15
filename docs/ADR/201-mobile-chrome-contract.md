# ADR-201: Mobile Chrome Contract (overlays + dock)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Stage** | 201.44 |
| **Date** | 2026-08-15 |
| **Deciders** | Product, Engineering |
| **Related** | ADR-100 (app shell / `--app-bottom-nav-height`), ADR-102 (filter drawer), Stages 200.134–200.135, 201.38–201.43 |

---

## 1. Context

Bottom sheets and dialogs were patched across Stages 201.38–201.43 (`hug` / `fill` / `respectAppBottomNav` / keyboard heuristics). Each fix solved one screenshot and broke another: sheets floated above the dock, or grew a large empty pad equal to tab-bar height, or the dock vanished on URL-bar resize. iPhone Safari and Android (Chrome / Samsung) disagreed because **one hook mixed three product intents**.

## 2. Decision

### 2.1 Three recipes only (SSOT)

| Recipe | When | Pin | Dock |
|--------|------|-----|------|
| **`action`** | Short menus (sort, “choose action”, listing more) | `bottom: 0`, height `auto`, `maxHeight` ≤ visualViewport; bottom pad = **safe-area only** | **Locked (hidden)** while open — sheet owns the bottom edge |
| **`form`** | Tall editors (search sheet, calendar create/block, sticky CTA) | Fill visualViewport (`top` + `height`); safe-area pad on content/footer | **Locked** while open |
| **`dialog`** | Centered / alert-style (report, short confirms) | Cap to visualViewport (`max` pin); desktop stays centered | **Locked** on mobile while open |

**Forbidden**

- `bottom: var(--app-bottom-nav-height)` or padding equal to full dock height to “sit above” the tab bar.
- Feature-local `visualViewport` math outside `buildVisualViewportPinStyle`.
- Hiding the dock via `innerHeight - vv.height` (URL-bar false positive). Keyboard = `bottomInset > KEYBOARD_VIEWPORT_SHRINK_PX` only.

### 2.2 Code map

| Layer | Module |
|-------|--------|
| Contract constants / fit aliases | `lib/layout/mobile-chrome-contract.js` |
| Dock lock (refcount + event) | `lib/layout/mobile-dock-lock.js`, `hooks/use-mobile-dock-lock.js` |
| Viewport pin | `hooks/use-visual-viewport-frame.js` → `recipe: 'action' \| 'form' \| 'dialog'` |
| Sheet API | `components/ui/sheet.jsx` — `fit="action" \| "form"` (`content`/`viewport` aliases) |
| Dialog API | `components/ui/dialog.jsx` — `mobileAnchor="bottom"` → `form`; default → `dialog` |
| Guest / partner docks | `MobileBottomNav`, `PartnerMobileBottomNav` — hide when dock locked or keyboard |

### 2.3 Product rule

While a bottom overlay is open, **the overlay owns the bottom of the screen**. Do not try to show the tab bar and the sheet “beautifully” at once — that caused the empty floor and floating panels.

## 3. Consequences

- Call sites migrate to `fit="action"` / `fit="form"` (aliases kept one release).
- Catalog search sheet uses **`form`** (sticky CTA + keyboard).
- Calendar / sort / listing action sheets use **`action`**.
- Playwright / unit tests assert recipe pins, not ad-hoc bottom offsets.

## 4. Supersedes

Informally supersedes the conflicting bits of Stages **201.38–201.43** overlay positioning. ADR-100 dock measurement and ADR-102 filter drawer remain; filter shell should eventually map to **`form`** if still Vaul-based.
