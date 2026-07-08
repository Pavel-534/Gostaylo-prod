# ADR-102: Mobile Catalog Filter Bottom-Sheet SSOT

| Field | Value |
|-------|--------|
| **Status** | Accepted — Phase 1 + Phase 2 complete |
| **Stage** | 177.4 UI — mobile filter bottom-sheet |
| **Date** | 2026-07-08 |
| **Deciders** | Product, Engineering |
| **Related** | ADR-101 (Public Search Chrome), `docs/SEARCH_FILTERS_QUERY_MAP.md`, Stage 177.4 services facets |

---

## 1. Context

Catalog «Все фильтры» (`SearchFiltersDialog`) used Radix **Dialog** on all breakpoints and wrote `extraFilters` to the URL **on every control change**. Mobile audit (2026-07-08) identified SSOT gaps vs `WhereCombobox` / `GuestsPopover` (Vaul **Drawer**) and vs Airbnb-like **apply-on-confirm** UX.

**Phase 1:** isolate filter body, introduce **draft state**; URL updates only on **Apply**.

**Phase 2:** `<md` → Vaul Drawer shell, sticky footer, touch 44×44, Select portal z-index above Drawer.

---

## 2. Decision

### 2.1 Layering (SSOT)

| Layer | Module | Role |
|-------|--------|------|
| URL contract | `lib/search/listings-page-url.js` | `ListingsExtraFilters`, parse/build — unchanged |
| Vertical panel | `lib/search/search-filter-panel-kind.js` | `housing` \| `transport` \| `service` |
| Draft lifecycle | `lib/hooks/use-catalog-extra-filters-draft.js` | open → clone → edit → apply / dismiss |
| Presentational body | `components/search/SearchFiltersPanel.jsx` | controlled `values` + `onChange` |
| Adaptive shell | `components/search/SearchFiltersShell.jsx` | `md+` Dialog, `<md` Vaul Drawer |
| Orchestrator | `components/search/SearchFiltersDialog.jsx` | draft hook + panel + shell |

### 2.2 State machine

```
committedExtraFilters  ←── URL + listings-catalog-client (SSOT runtime)
        │
        │  open=true
        ▼
   clone(committed) → draftExtraFilters
        │
        ├─ user edits controls → onChange(draft) only (no URL)
        │
        ├─ «Сбросить всё» → resetDraft() → defaultExtraFilters() (draft only)
        │
        ├─ «Показать N» / Apply → applyDraft() → onCommit(draft) → URL via parent
        │                      → close shell
        │
        └─ overlay / X / Esc / swipe dismiss → discardDraft() → clone(committed)
                                         → close shell (committed unchanged)
```

**Invariant:** `onExtraFiltersChange` / `setExtraFilters` in catalog is **not** called until `applyDraft`.

### 2.3 Z-index matrix (normative)

| Layer | z-index | Notes |
|-------|---------|--------|
| AppHeader | 100 | fixed top |
| Public search compact / FAB | 30–120 | ADR-101 |
| Catalog map sheet | 85–90 | below header |
| Filter Dialog (desktop) | 120 | overlay + content |
| Filter Select portal (desktop) | 130 | `SEARCH_FILTERS_SHELL_SELECT_DIALOG_Z` |
| Filter Drawer overlay | 220 | `components/ui/drawer.jsx` |
| Filter Drawer content | 230 | vaul sheet body |
| Filter Select portal (mobile) | 240 | `SEARCH_FILTERS_SHELL_SELECT_DRAWER_Z` |
| Mobile search bottom sheet | 120 | avoid opening both |

---

## 3. Scope

### Phase 1 ✅

- `useCatalogExtraFiltersDraft`
- `SearchFiltersPanel` extraction
- Dialog wired to draft + explicit Apply
- Dismiss without persisting draft

### Phase 2 ✅

- `SearchFiltersShell` — Dialog vs Drawer via `useIsMobile()`
- Mobile: `max-h-[92dvh]`, swipe handle (vaul), sticky footer, `pb-safe`
- Apply CTA: full width, `min-h-12` (48px)
- Service panel touch targets ≥ 44px (`min-h-11`)

### Out of scope (future)

- Draft preview `resultCount` API
- New service facet fields beyond 177.4 registry

---

## 4. Implementation checklist

| ID | Task | Status |
|----|------|--------|
| T4.28 | This ADR | ✅ |
| T4.29 | `useCatalogExtraFiltersDraft` | ✅ |
| T4.30 | `SearchFiltersPanel` | ✅ |
| T4.31 | Dialog → Shell migration | ✅ |
| T4.32 | Mobile Drawer shell | ✅ |
| T4.33 | Touch 44px audit (service panel) | ✅ |
| T4.34 | `SearchFiltersShell` split | ✅ |

---

## 5. Consequences

- Filtering applies **on footer Apply**, not live.
- «Сбросить всё» resets **draft** only until Apply.
- `resultCount` in footer reflects **committed** search until Apply.
- Mobile drawer uses vaul swipe; desktop keeps centered Dialog with sticky footer.
