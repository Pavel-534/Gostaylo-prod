/**
 * Stage 170.13 — Partner / Admin workspace shell SSOT (ADR-100 `--app-header-height`).
 *
 * Frame fills viewport below fixed AppHeader — no empty padding band.
 * Toolbar is flex-shrink-0 (not sticky + double offset); page body scrolls inside main.
 */

/** Fixed area below AppHeader — sidebar + main. */
export const WORKSPACE_FRAME_CLASS =
  'fixed inset-x-0 bottom-0 top-[var(--app-header-height,64px)] flex min-h-0'

/** Main column: toolbar + scroll body. */
export const WORKSPACE_MAIN_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'

/** Desktop toolbar (breadcrumbs / quick actions) — pinned by flex, not sticky. */
export const WORKSPACE_TOOLBAR_CLASS =
  'hidden lg:flex lg:flex-col shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm z-10'

/** Inner row inside WORKSPACE_TOOLBAR_CLASS (breadcrumbs + actions). */
export const WORKSPACE_TOOLBAR_ROW_CLASS =
  'flex shrink-0 items-center justify-between px-6 py-3'

/** Mobile toolbar strip under header. */
export const WORKSPACE_MOBILE_TOOLBAR_CLASS =
  'lg:hidden shrink-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2'

/** Scrollable page content inside main. */
export const WORKSPACE_SCROLL_CLASS =
  'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 lg:p-6'

/**
 * Sticky subheader inside WORKSPACE_SCROLL — top of scrollport, not viewport header offset.
 * Do not use `app-sticky-below-header` here (nested scroll; Stage 170.13).
 */
export const WORKSPACE_SCROLL_STICKY_CLASS =
  'sticky top-0 z-40 isolate border-b border-slate-200 bg-white shadow-sm'

/**
 * Sidebar: fixed overlay on mobile; in-flow column on lg inside WORKSPACE_FRAME_CLASS.
 * Pair with `app-workspace-sidebar` (mobile geometry only).
 */
export const WORKSPACE_SIDEBAR_CLASS =
  'fixed z-50 flex w-64 flex-col app-workspace-sidebar transition-all duration-300 ease-out lg:relative lg:z-auto lg:h-full lg:max-h-none lg:shrink-0 lg:overflow-y-auto lg:translate-x-0'
